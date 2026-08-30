import { ChatOpenAI } from "@langchain/openai"
import dotenv from 'dotenv'
dotenv.config()

console.log(process.env.OPENAI_API_KEY)
console.log(process.env.OPENAI_BASE_URL)

const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL_NAME || 'qwen3.8-flash',
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    }
})

const response = await model.invoke("Hello, how are you?")
console.log(response.content)