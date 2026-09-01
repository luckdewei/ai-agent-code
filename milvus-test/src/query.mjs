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

        console.log('执行查询...')
        const query = "我做饭或学习的日记"

        const queryVector = await getEmbeddings(query)

        const searchResult = await milvusClient.search({
            collection_name: COLLECTION_NAME,
            data: [queryVector], // 查询向量
            limit: 2, // 返回结果数量
            output_fields: ['id', 'content', 'date', 'mood', 'tags'], // 输出字段
            metric_type: MetricType.COSINE,
            index_type: IndexType.IVF_FLAT
        })

        console.log(`查询结果: ${searchResult.results.length}条数据`)
        searchResult.results.forEach((result) => {
            console.log(`ID: ${result.id}`)
            console.log(`内容: ${result.content}`)
            console.log(`日期: ${result.date}`)
            console.log(`情绪: ${result.mood}`)
            console.log(`标签: ${result.tags?.join(',') || '无'}`)
            console.log('--------------------------------\n')
        })

        
    } catch (error) {
        console.error('Error:', error.message)
    }
}


main()