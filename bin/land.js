const program = require('commander')
const inquirer = require('inquirer')
const fs = require('mz/fs')
const os = require('os')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const exec = require('child_process').exec
const configPath = path.join(os.homedir(), '/.landrc.json')

program.version(require('../package').version).usage('<command> [options]')

program
  .command('init')
  .description('init command')
  .action(async () => {
    const exists = await fs.exists(configPath)
    if (exists) {
      console.log(`Exist config file at path:${configPath}, please edit it directly`)
      return
    }
    const questions = [
      {
        type: 'input',
        name: 'workspace',
        message: 'Enter workspace path',
        default() {
          return '/data/frontend/workspace'
        },
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter project name',
      },
      {
        type: 'input',
        name: 'repo',
        message: 'Enter git repo',
      },
      {
        type: 'input',
        name: 'dest',
        message: 'Enter deploy path',
      },
    ]
    const answers = await inquirer.prompt(questions)
    const initJson = {
      workspace: answers.workspace,
      project: [
        {
          name: answers.name,
          repo: answers.repo,
          dest: answers.dest,
        },
      ],
    }
    await fs.writeFile(configPath, JSON.stringify(initJson, null, 2), 'utf8')
    console.log('init success')
  })

program
  .command('add')
  .description('add new project')
  .action(async () => {
    const exists = await fs.exists(configPath)
    if (!exists) {
      console.log(`Can't read config file at path:${configPath}, please init first`)
      return
    }
    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Enter project name',
      },
      {
        type: 'input',
        name: 'repo',
        message: 'Enter git repo',
      },
      {
        type: 'input',
        name: 'dest',
        message: 'Enter deploy path',
      },
    ]
    const answers = await inquirer.prompt(questions)
    const jsonString = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(jsonString)
    config.project.push(answers)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
    console.log('add success')
  })

program
  .command('delete')
  .description('delete one project')
  .action(async () => {
    const exists = await fs.exists(configPath)
    if (!exists) {
      console.log(`Can't read config file at path:${configPath}, please init first`)
      return
    }
    const jsonString = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(jsonString)
    const questions = [
      {
        type: 'list',
        name: 'name',
        message: 'Which one do you want to deleted?',
        choices: config.project.map((_) => _.name),
      },
    ]
    const answers = await inquirer.prompt(questions)
    config.project = config.project.filter((_) => _.name !== answers.name)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
    console.log(`delete ${answers.name} success`)
  })

program
  .command('deploy')
  .description('deploy once')
  .action(async () => {
    const exists = await fs.exists(configPath)
    if (!exists) {
      console.log(`Can't read config file at path:${configPath}, please init first`)
      return
    }
    const jsonString = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(jsonString)
    const questions = [
      {
        type: 'list',
        name: 'name',
        message: 'Which one do you want to deploy?',
        choices: config.project.map((_) => _.name),
      },
      {
        type: 'input',
        name: 'branch',
        message: 'Which branch?',
        default() {
          return 'master'
        },
      },
    ]
    const answers = await inquirer.prompt(questions)
    const project = config.project.find((_) => _.name === answers.name)
    console.log(project)
    const workspace = path.join(config.workspace, project.name)
    rimraf.sync(workspace)
    mkdirp.sync(workspace, 0755)
    mkdirp.sync(project.dest, 0755)

    // git clone
    const gitProcess = exec(
      `
      git clone ${project.repo} . &&
      git checkout -B ${answers.branch} origin/${answers.branch}
    `,
      {
        cwd: workspace,
      }
    )
    gitProcess.stdout.pipe(process.stdout)

    gitProcess.on('exit', (code) => {
      // npm install && build && cp
      const npmProcess = exec(
        `cnpm install &&
        npm run build &&
        cp -r ${path.join(workspace, 'dist/*')} ${project.dest}`,
        {
          cwd: workspace,
        }
      )
      npmProcess.stdout.pipe(process.stdout)
      npmProcess.on('exit', async (code) => {
        if (code !== 0) {
          return
        }
        console.log('!!!!! SUCCESS !!!!!')
      })
    })
  })

program.parse(process.argv)
