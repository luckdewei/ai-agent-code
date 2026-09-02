import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system'
import {
    HumanMessage,
    SystemMessage,
    AIMessage,
} from '@langchain/core/messages'
import path from 'node:path'

const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
})

async function fileHistoryTest() {
    // 指定文件路径
    const filePath = path.join(process.cwd(), 'chat_history.json')
    const sessionId = 'user_session_001'

    const systemMessage = new SystemMessage(
        '你是一个友好的做菜助手，喜欢分享美食和烹饪技巧。',
    )

    const restoredHistory = new FileSystemChatMessageHistory({
        filePath: filePath,
        sessionId: sessionId,
    })

    // 加载恢复的历史记录
    const restoredMessages = await restoredHistory.getMessages()
    console.log(`加载恢复的历史记录: ${restoredMessages.length} 条`)

    restoredMessages.forEach((message, index) => {
        const type = message.type
        const content = message.content
        const prefix = type === 'human' ? '用户' : '助手'
        console.log(`${index + 1}. [${prefix}]: ${content}`)
    })

    console.log('[第三轮对话]')
    const userMessage3 = new HumanMessage('需要哪些食材？')
    await restoredHistory.addMessage(userMessage3)

    const messages3 = [systemMessage, ...(await restoredHistory.getMessages())]
    const response3 = await model.invoke(messages3)
    await restoredHistory.addMessage(response3)

    console.log(`用户: ${userMessage3.content}`)
    console.log(`助手: ${response3.content}`)
    console.log(`✓ 对话已保存到文件\n`)
}

fileHistoryTest().catch(console.error)
