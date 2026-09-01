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

        console.log('创建 collection...')

        await milvusClient.createCollection({
            collection_name: COLLECTION_NAME,
            fields: [
                { name: 'id', data_type: DataType.VarChar, max_length: 50, is_primary_key: true },
                { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM },
                { name: 'content', data_type: DataType.VarChar, max_length: 5000 },
                { name: 'date', data_type: DataType.VarChar, max_length: 50 },
                { name: 'mood', data_type: DataType.VarChar, max_length: 50 },
                { name: 'tags', data_type: DataType.Array, element_type: DataType.VarChar, max_capacity: 10, max_length: 50 }
            ]
        })

        console.log('collection 创建成功')

        console.log('创建索引...')

        await milvusClient.createIndex({
            collection_name: COLLECTION_NAME,
            field_name: 'vector',
            index_type: IndexType.IVF_FLAT, // 索引类型 - 倒排索引
            metric_type: MetricType.COSINE, // 距离度量方式 - 余弦相似度
            params: {
                nlist: 1024 // 量化因子
            }
        })

        console.log('索引创建成功')
        
        console.log('加载 collection...')
        await milvusClient.loadCollection({ collection_name: COLLECTION_NAME })
        console.log('collection 加载成功')

        console.log('插入数据...')

        const diaryContents = [
            {
              id: 'diary_001',
              content: '今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。',
              date: '2026-01-10',
              mood: 'happy',
              tags: ['生活', '散步']
            },
            {
              id: 'diary_002',
              content: '今天工作很忙，完成了一个重要的项目里程碑。团队合作很愉快，感觉很有成就感。',
              date: '2026-01-11',
              mood: 'excited',
              tags: ['工作', '成就']
            },
            {
              id: 'diary_003',
              content: '周末和朋友去爬山，天气很好，心情也很放松。享受大自然的感觉真好。',
              date: '2026-01-12',
              mood: 'relaxed',
              tags: ['户外', '朋友']
            },
            {
              id: 'diary_004',
              content: '今天学习了 Milvus 向量数据库，感觉很有意思。向量搜索技术真的很强大。',
              date: '2026-01-12',
              mood: 'curious',
              tags: ['学习', '技术']
            },
            {
              id: 'diary_005',
              content: '晚上做了一顿丰盛的晚餐，尝试了新菜谱。家人都说很好吃，很有成就感。',
              date: '2026-01-13',
              mood: 'proud',
              tags: ['美食', '家庭']
            }
        ]

        // 将日记内容转换为向量数据
        const diaryData = await Promise.all(
            diaryContents.map(async (diary) => {
                const vector = await getEmbeddings(diary.content)
                return {
                    ...diary,
                    vector: vector
                }
            })
        )

        const insertResult = await milvusClient.insert({
            collection_name: COLLECTION_NAME,
            data: diaryData
        })

        console.log('数据插入成功:', insertResult.insert_cnt, '条数据\n')

    } catch (error) {
        console.error('Error:', error.message)
        process.exit(1)
    }
}

main()