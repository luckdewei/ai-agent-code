import { getEncodingNameForModel, getEncoding } from "js-tiktoken"

const modelName = 'gpt-4'

const encodingName = getEncodingNameForModel(modelName)

console.log(encodingName) // 模型的编码名称 cl100k_base

const enc = getEncoding(encodingName)

console.log(enc.encode('apple').length) // 编码后的 token 列表长度

console.log(enc.encode('苹果').length) 

// 结论： 字符和token数量没有确定的关系，对于需要精确控制token的场景，就不能单纯使用字符去分割，可以使用 tokenTextSplitter 来分割