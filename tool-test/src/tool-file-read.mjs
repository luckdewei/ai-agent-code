import { ChatOpenAI } from "@langchain/openai"
import { tool } from "@langchain/core/tools"
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import 'dotenv/config'
import fs from 'node:fs/promises'
import { z } from 'zod'


const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL_NAME || 'qwen3.8-flash',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    }
})

/**
 * 第一个参数：执行函数，输入参数为工具的输入参数，输出为工具的输出
 * 第二个参数：工具的配置，包括工具的名称、描述、输入参数的schema等
 * 返回值：工具对象
 * 工具对象的属性：
 * - name：工具的名称
 * - description：工具的描述
 * - schema：工具的输入参数的schema
 * - invoke：执行工具的函数
 * - bind：绑定工具的函数
 */
const readFileTool = tool(
    async ({ file_path }) => {
        const file = await fs.readFile(file_path, 'utf8')
        console.log(`[工具调用] read_file("${file_path}" - 成果读取${file.length}字节`)
        return `文件内容:\n${file}`
    },
    {
        name: 'read_file',
        description: '用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或者绝对路径）。',
        schema: z.object({
            file_path: z.string().describe('要读取的文件路径')
        })
    }
)

const tools = [
    readFileTool,
]

const modelWithTools = model.bindTools(tools)

const messages = [
    new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。
        
    工作流程：
    1. 用户要求读取文件时，立即调用 read_file 工具
    2. 等待工具返回文件内容
    3. 基于文件内容进行分析和解释
    
    可用工具：
    - read_file: 读取文件内容
`),
    new HumanMessage(`请读取 ./src/tool-file-read.mjs 文件内容，并解释文件内容。`)
]

let response = await modelWithTools.invoke(messages)
// console.log(response)

messages.push(response)

while (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`\n[监测到${response.tool_calls.length}个工具调用]\n`)

    // 执行所有工具调用
    const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
            const tool = tools.find(t => t.name === toolCall.name)
            if (!tool) {
                return `错误：未找到工具: ${toolCall.name}`
                // throw new Error(`未找到工具: ${toolCall.name}`)
            }


            console.log(`[执行工具] ${toolCall.name}("${JSON.stringify(toolCall.args)}")`)
            try {
                const result = await tool.invoke(toolCall.args)
                return result
            } catch (error) {
                return `错误：执行工具失败: ${error.message}`
            }
        })
    )

    // 将工具结果都添加到消息历史

    response.tool_calls.forEach((toolCall, index) => {
        messages.push(
            new ToolMessage({
                content: toolResults[index],
                tool_call_id: toolCall.id,
            })
        )
    })

    // 再次调用模型，传入工具结果
    response = await modelWithTools.invoke(messages)
}


console.log(`\n[最终回答]\n${response.content}`)