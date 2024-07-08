import { Chalk } from 'chalk';
import dayjs from 'dayjs';

const chalk = new Chalk({ level: 1 });
export const debug = (str: string) => console.info('[', dayjs().format('DD/MM HH:mm:ss'), ']', chalk.white(str));
export const info = (str: string) => console.info('[', dayjs().format('DD/MM HH:mm:ss'), ']', chalk.blue(str));
export const warn = (str: string) => console.warn('[', dayjs().format('DD/MM HH:mm:ss'), ']', chalk.yellow(str));
export const error = (str: string) => console.error('[', dayjs().format('DD/MM HH:mm:ss'), ']', chalk.red(str));
