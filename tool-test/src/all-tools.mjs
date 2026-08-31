import { tool } from "@langchain/core/tools"
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { z } from 'zod'

/**
 * 读取文件工具
 * @param {Object} params 参数
 * @param {string} params.file_path 要读取的文件路径
 * @returns {Promise<string>} 读取文件的返回值
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

/**
 * 写入文件工具
 * @param {Object} params 参数
 * @param {string} params.file_path 要写入的文件路径
 * @param {string} params.content 要写入的文件内容
 * @returns {Promise<string>} 写入文件的返回值
 */
const writeFileTool = tool(
    async ({ file_path, content }) => {
        try {
            // 获取文件所在的目录
            const dir = path.dirname(file_path)
            // 创建文件所在的目录
            await fs.mkdir(dir, { recursive: true })
            // 写入文件
            await fs.writeFile(file_path, content, 'utf8')
            console.log(`[工具调用] write_file("${file_path}" - 成果写入${content.length}字节`)
            return `文件内容:\n${content}`
        } catch (error) {
            console.error(`[工具调用] write_file("${file_path}" - 失败: ${error.message}`)
            return `写入文件失败: ${error.message}`
        }
    },
    {
        name: 'write_file',
        description: '用此工具来写入文件内容。向指定路径写入文件内容，自动创建目录。',
        schema: z.object({
            file_path: z.string().describe('要写入的文件路径'),
            content: z.string().describe('要写入的文件内容')
        })
    }
)

/**
 * 执行命令工具
 * @param {Object} params 参数
 * @param {string} params.command 要执行的命令
 * @param {string} params.workingDirectory 工作目录，可选，默认当前工作目录
 * @returns {Promise<string>} 执行命令的返回值
 */
const executeCommandTool = tool(
    async ({ command, workingDirectory }) => {
            const cwd = workingDirectory || process.cwd()

            console.log(`[工具调用] execute_command("${command}" - 当前工作目录: ${cwd}`)

            return new Promise((resolve, reject) => {
                const [cmd, ...args] = command.split(' ')

                const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true })
                let errMsg = ''

                child.on('error', (err) => {
                    errMsg = err.message
                })

                child.on('close', (code) => {
                    if (code === 0) {
                        console.log(`[工具调用] execute_command("${command}" - 命令执行成功`)
                        const cwdInfo = workingDirectory
                        ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中执行成功。如果需要在这个项目目录中继续执行其他命令，请使用 workingDirectory: "${workingDirectory}"。`
                        : '';
                        
                        resolve(`命令执行成功: ${command}${cwdInfo}`)
                    } else {
                        console.log(`[工具调用] execute_command("${command}" - 命令执行失败: ${errMsg}, 错误码: ${code}`)
                        resolve(`命令执行失败: ${command}, 错误信息: ${errMsg}, \n错误码: ${code}`)
                    }
                })
            })
    },
    {
        name: 'execute_command',
        description: '执行系统命令，支持制定工作目录，实时显示输出',
        schema: z.object({
            command: z.string().describe('要执行的命令'),
            workingDirectory: z.string().describe('工作目录，可选，默认当前工作目录').optional()
        })
    }
)



/**
 * 列出目录工具
 * @param {Object} params 参数
 * @param {string} params.directoryPath 目录路径
 * @returns {Promise<string>} 列出目录的返回值
 */
const listDirectoryTool = tool(
    async ({ directoryPath }) => {
        try {
            const files = await fs.readdir(directoryPath)
            console.log(`[工具调用] list_directory("${directoryPath}" - 找到${files.length}个项目`)
            return `目录内容:\n${files.map(f => `- ${f}`).join('\n')}`
        } catch (error) {
            console.error(`[工具调用] list_directory("${directoryPath}" - 错误: ${error.message}`)
            return `列出目录失败: ${error.message}`
        }
    },
    {
        name: 'list_directory',
        description: '列出指定目录下的文件和文件夹',
        schema: z.object({
            directoryPath: z.string().describe('目录路径')
        })
    }
)

export { readFileTool, writeFileTool, executeCommandTool, listDirectoryTool }