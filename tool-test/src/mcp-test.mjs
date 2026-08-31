import { ChatOpenAI } from '@langchain/openai'
import 'dotenv/config'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages'
import { readFileTool, writeFileTool, executeCommandTool, listDirectoryTool } from './all-tools.mjs'
import chalk from 'chalk'



const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.MODEL || 'qwen-plus',
    temperature: 0,
    configuration: {
        baseURL: process.env.BASE_URL
    },
})

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'my-mcp-server': {
            command: "node",
            args: [
                "/Users/rihime/Desktop/study/ai-agent-code/tool-test/src/my-mcp-server.mjs"
            ]
        },
        "amap-maps-streamableHTTP": {
            "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY
        },
        "filesystem": { // 文件系统工具 - 用于读取和写入文件
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-filesystem",
                ...(process.env.ALLOWED_PATHS.split(',') || [])
            ]
        },
        "chrome-devtools": {
            "command": "npx",
            "args": [
                "-y",
                "chrome-devtools-mcp@latest"
            ]
        },
    }
})

const tools = await mcpClient.getTools()

const modelWithTools = model.bindTools(tools)


/**
 * 使用工具完成任务
 * @param {*} query 任务描述
 * @param {*} maxIterations 最大迭代次数
 * @returns {Promise<string>} 最终回复
 */
async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        new HumanMessage(query),
    ]


    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.green(`正在等待 AI 思考... (${i + 1}/${maxIterations})`))

        const response = await modelWithTools.invoke(messages)
        messages.push(response)

        if (!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\nAI 思考完成，最终回复: \n${response.content}\n`)
            return response.content
        }

        console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`))
        console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`))

        // 执行工具调用
        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name)
            if (foundTool) {
                const toolResult = await foundTool.invoke(toolCall.args)

                // 确保 content 是字符串类型
                let contentStr
                if (typeof toolResult === 'string') {
                    contentStr = toolResult
                } else if (toolResult && toolResult.text) {
                    // 如果返回对象有 text 字段，优先使用
                    contentStr = toolResult.text
                }

                messages.push(new ToolMessage({
                    tool_call_id: toolCall.id,
                    content: contentStr,
                }))
            }
        }
    }

    return messages[messages.length - 1].content
}


try {
    // await runAgentWithTools('北京南站附近的酒店，以及去的路线')
    // await runAgentWithTools('北京南站附近的3个酒店，以及去的路线, 路线规划生成文档保存到 /Users/rihime/Desktop/study/ai-agent-code/tool-test/ 的一个 md 文件')
    await runAgentWithTools("北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名")
    await mcpClient.close()
} catch (error) {
    console.error(`\n❌ 错误: ${error.message}\n`)
}