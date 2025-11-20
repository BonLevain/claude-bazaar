#!/usr/bin/env node
import { Command } from 'commander';
import { FileSystem } from './services/FileSystem.js';
import { ConfigLoader } from './services/ConfigLoader.js';
import { InitCommand } from './commands/init.js';
import { BuildCommand } from './commands/build.js';

function createProgram(): Command {
  const program = new Command();

  // Dependencies
  const fileSystem = new FileSystem();
  const configLoader = new ConfigLoader(fileSystem);

  // Commands
  const initCommand = new InitCommand(fileSystem);
  const buildCommand = new BuildCommand(fileSystem, configLoader);

  program
    .name('shipyard')
    .description('Deploy Claude Code projects as containers')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a new Shipyard project')
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
    .option('-t, --tag <tag>', 'Image tag')
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

  return program;
}

const program = createProgram();
program.parse();
