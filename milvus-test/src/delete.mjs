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

        console.log('删除数据...')
        const deleteId = 'diary_005'

        const deleteResult = await milvusClient.delete({
            collection_name: COLLECTION_NAME,
            ids: [deleteId]
        })

        console.log('数据删除成功:', deleteResult.delete_cnt, '条数据\n')
        
        const conditionResult = await milvusClient.delete({
            collection_name: COLLECTION_NAME,
            filter: `mood == "sad"`
        })

        console.log('数据删除成功:', conditionResult.delete_cnt, '条数据\n')

    } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
    }
}

main()