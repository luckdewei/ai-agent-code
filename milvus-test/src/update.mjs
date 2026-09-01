import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node'
import "dotenv/config"
import { OpenAIEmbeddings } from "@langchain/openai"

const COLLECTION_NAME = "ai_diary"

// 向量维度
const VECTOR_DIM = 1024

// 创建OpenAI embeddings实例
const embeddings = new OpenAIEmbeddings({
    model: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL
    },
    dimensions: VECTOR_DIM
})

// 创建Milvus客户端实例
const milvusClient = new MilvusClient({
    address: 'localhost:19530'
})

async function getEmbeddings(query) {
    const result = await embeddings.embedQuery(query)
    return result
}

async function main() {
    try {
        console.log('链接Milvus...')
        await milvusClient.connect()
        console.log('Milvus连接成功')
        

        console.log('更新数据...')
        const updateId = 'diary_001'
        const updatedContent = {
          id: updateId,
          content: '今天下了一整天的雨，心情很糟糕。工作上遇到了很多困难，感觉压力很大。一个人在家，感觉特别孤独。',
          date: '2026-01-10',
          mood: 'sad',
          tags: ['生活', '散步', '朋友']
        }

        const vector = await getEmbeddings(updatedContent.content)
        const updatedData = {
            ...updatedContent,
            vector: vector
        }

        const updateResult = await milvusClient.upsert({
            collection_name: COLLECTION_NAME,
            data: [updatedData]
        })
        
        console.log('数据更新成功:', updateResult.upsert_cnt, '条数据\n')

    } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
    }
}

main()