import { spawn } from 'node:child_process'

// 要执行的命令
// const command = 'ls -la'

const command = 'echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts';



/**
 * 当前工作目录
 */
const cwd = process.cwd()

// 解析命令和参数
const [cmd, ...args] = command.split(' ')

// 执行命令  spawn 创建一个子进程来跑命令
/**
 * 第一个参数：命令
 * 第二个参数：命令的参数
 * 第三个参数：当前工作目录
 * 返回值：子进程对象
 * 子进程对象的属性：
 * - cwd：当前工作目录
 * - stdio：子进程的输入输出流
 * - shell：是否使用shell执行命令
 */
const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true })


let errMsg = ''

/**
 * 监听子进程的错误事件
 * 参数：错误对象
 */
child.on('error', (err) => {
    errMsg = err.message
})

/**
 * 监听子进程的关闭事件
 * 参数：关闭码，如果为0，则表示命令执行成功，否则表示命令执行失败
 */
child.on('close', (code) => {
    if (code === 0) {
        process.exit(0)
    } else {
        if (errMsg) {
            console.error(`错误：${errMsg}`)
        }
        process.exit(code || 1)
    }
})