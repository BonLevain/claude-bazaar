#!/usr/bin/env node
import { Command } from 'commander';
import { FileSystem } from './services/FileSystem.js';
import { ConfigLoader } from './services/ConfigLoader.js';
import { InitCommand } from './commands/init.js';
import { BuildCommand } from './commands/build.js';
import { RunCommand } from './commands/run.js';
import { ServeCommand } from './commands/serve.js';

function createProgram(): Command {
  const program = new Command();

  // Dependencies
  const fileSystem = new FileSystem();
  const configLoader = new ConfigLoader(fileSystem);

  // Commands
  const initCommand = new InitCommand(fileSystem);
  const buildCommand = new BuildCommand(fileSystem, configLoader);
  const runCommand = new RunCommand(configLoader);
  const serveCommand = new ServeCommand();

  program
    .name('bazaar')
    .description('Deploy Claude Code projects as containers')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a new Bazaar project')
    .action(async () => {
      try {
        await initCommand.execute();
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    });

  program
    .command('build')
    .description('Build Docker image')
    .option('-t, --tag <tag>', 'Image tag (default: name:version from config)')
    .option('--push', 'Push to registry')
    .option('--registry <registry>', 'Container registry')
    .action(async (options) => {
      try {
        await buildCommand.execute(process.cwd(), options);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    });

  program
    .command('run')
    .description('Run Docker container')
    .option('-t, --tag <tag>', 'Image tag')
    .option('-p, --port <port>', 'Port to expose', parseInt)
    .option('-d, --detach', 'Run in background')
    .action(async (options) => {
      try {
        await runCommand.execute(process.cwd(), options);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    });

  program
    .command('serve')
    .description('Start the web interface')
    .option('--projects <urls>', 'Comma-separated project container URLs (default: http://localhost:3000)', (val) => val.split(','))
    .option('-p, --port <port>', 'Port for web interface', parseInt)
    .action(async (options) => {
      try {
        await serveCommand.execute(options);
      } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
      }
    });

  return program;
}

const program = createProgram();
program.parse();
