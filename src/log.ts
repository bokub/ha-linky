import { Chalk } from 'chalk';

const chalk = new Chalk({ level: 1 });
export const debug = (str: string) => console.info(chalk.white(str));
export const info = (str: string) => console.info(chalk.blue(str));
export const warn = (str: string) => console.warn(chalk.yellow(str));
export const error = (str: string) => console.error(chalk.red(str));
