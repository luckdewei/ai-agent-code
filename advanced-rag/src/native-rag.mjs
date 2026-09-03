import 'dotenv/config'
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { Milvus } from '@langchain/community/vectorstores/milvus'

const COLLECTION_NAME = 'ebook_collection'
const TOP_K = 5

const GraphState = Annotation.Root({
    question: Annotation,
    k: Annotation,
    documents: Annotation,
    generation: Annotation,
})

const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
    temperature: 0,
})

const embeddings = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    dimensions: 1024,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
})

let vectorStore = null

/**
 * 检索与问题相关的文档
 * @param {*} question 问题
 * @param {*} k 检索的文档数量
 */
async function retrieveRelevantContent(question, k = TOP_K) {
    try {
        const docsWithScore = await vectorStore.similaritySearchWithScore(
            question,
            k,
        )
        return docsWithScore.map(([doc, score]) => ({
            score,
            content: doc.pageContent,
            id: doc.metadata?.id ?? 'unknown',
            book_id: doc.metadata?.book_id ?? '未知',
            chapter_num: doc.metadata?.chapter_num ?? '未知',
            index: doc.metadata?.index ?? '未知',
        }))
    } catch (error) {
        console.error('检索内容时出错:', error.message)
        return []
    }
}

/**
 * 检索节点
 * @param {*} state 状态
 * @returns
 */
const retrieveNode = async (state) => {
    const documents = await retrieveRelevantContent(state.question, state.k)
    return {
        question: state.question,
        k: state.k,
        documents,
    }
}

/**
 * 生成节点
 * @param {*} state 状态
 * @returns
 */
const generateNode = async (state) => {
    const context = state.documents
        .map(
            (item, i) =>
                `[片段 ${i + 1}]
章节: 第 ${item.chapter_num} 章
内容: ${item.content}`,
        )
        .join('\n\n━━━━━\n\n')

    const prompt = `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

请根据以下《天龙八部》小说片段内容回答问题：
${context}

用户问题: ${state.question}

回答要求：
1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
2. 可以综合多个片段的内容，提供完整的答案
3. 如果片段中没有相关信息，请如实告知用户
4. 回答要准确，符合小说的情节和人物设定
5. 可以引用原文内容来支持你的回答

AI 助手的回答:`

    process.stdout.write('\n【AI 回答（流式）】\n')
    let generation = ''
    const stream = await model.stream(prompt)
    for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : ''
        if (!text) continue
        generation += text
        process.stdout.write(text)
    }
    process.stdout.write('\n')

    return {
        question: state.question,
        k: state.k,
        documents: state.documents,
        generation,
    }
}

const graph = new StateGraph(GraphState)
    .addNode('retrieve', retrieveNode)
    .addNode('generate', generateNode)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', END)
    .compile()


async function main() {
    const question = '阿朱的结局是什么？'
    const kArg = 5

    // 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
    const drawable = await graph.getGraphAsync()
    const mermaid = drawable.drawMermaid({ withStyles: true })
    console.log(mermaid)

    console.log('连接到 Milvus...')
    vectorStore = await Milvus.fromExistingCollection(embeddings, {
        collectionName: COLLECTION_NAME,
        url: 'localhost:19530',
        textField: 'content',
        primaryField: 'id',
        vectorField: 'vector',
        indexCreateOptions: {
            metric_type: 'COSINE',
            index_type: 'HNSW', // 索引类型 HNSW, FLAT, IVF_FLAT, IVF_SQ8, RNSG, HNSW, ANNOY
            params: { M: 16, efConstruction: 200 }, // 索引参数 M: 16, efConstruction: 200
            search_params: { ef: 64 }, // 搜索参数 ef: 64
        },
    })
    vectorStore.indexSearchParams = {
        metric_type: 'COSINE', // 距离度量方式 COSINE, L2, IP
        params: JSON.stringify({ ef: 64 }), // 搜索参数 ef: 搜索结果数量
    }
    console.log('✓ 已连接\n')

    try {
        await vectorStore.client.loadCollection({
            collection_name: COLLECTION_NAME,
        })
        console.log(`✓ 集合 ${COLLECTION_NAME} 已加载\n`)
    } catch (error) {
        if (!error.message.includes('already loaded')) {
            throw error
        }
        console.log(`✓ 集合 ${COLLECTION_NAME} 已处于加载状态\n`)
    }

    console.log('='.repeat(80))
    console.log(`问题: ${question}`)
    console.log('='.repeat(80))

    const result = await graph.invoke({
        question,
        k: Number.isFinite(kArg) ? kArg : TOP_K,
        documents: [],
        generation: '',
    })

    console.log('\n【检索相关内容】')
    if (result.documents.length === 0) {
        console.log('未找到相关内容')
        console.log('\n【AI 回答】')
        console.log('抱歉，我没有找到相关的《天龙八部》内容。')
        return
    } else {
        result.documents.forEach((item, i) => {
            console.log(`\n[片段 ${i + 1}] 相似度: ${item.score.toFixed(4)}`)
            console.log(`书籍: ${item.book_id}`)
            console.log(`章节: 第 ${item.chapter_num} 章`)
            console.log(`片段索引: ${item.index}`)
            console.log(
                `内容: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}`,
            )
        })
    }

    if (!result.generation) {
        console.log('\n【AI 回答】')
        console.log('模型未返回内容。')
    }
}

main()
