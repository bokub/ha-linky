import { readdirSync, createReadStream, existsSync } from 'node:fs';
import { debug, info, error } from './log.js';
import { parse } from 'csv-parse';
import { formatHistoryFile, HistoryRawPoint, DataPoint } from './format.js';
import dayjs from 'dayjs';

const baseDir = '/config';
const userDir = '/addon_configs/cf6b56a3_linky';

export async function getMeterHistory(prm: string, isProduction: boolean): Promise<DataPoint[]> {
  if (!existsSync(baseDir)) {
    debug(`Cannot find folder ${userDir}`);
    return [];
  }
  const files = readdirSync(baseDir);

  debug(`Found ${files.length} ${files.length > 1 ? 'files' : 'file'} in ${userDir}`);

  for (const filename of files) {
    try {
      const match = filename.match(/historique_(conso|prod)_(\d+).*\.csv$/);
      if (!match) {
        debug(`Skipping file ${filename} because filename is not recognized`);
        continue;
      }
      const isFileProduction = match[1] === 'prod';
      const filePRM = match[2];

      if (prm === filePRM && isProduction === isFileProduction) {
        return readHistory(filename);
      }
    } catch (e) {
      error(`Error while reading ${filename}: ${e.toString()}`);
    }
  }

  debug(`No history file found for PRM ${prm} (${isProduction ? 'production' : 'consumption'})`);

  return [];
}

async function readHistory(filename: string): Promise<DataPoint[]> {
  info(`Importing historical data from ${filename}`);

  const parser = createReadStream(`${baseDir}/${filename}`).pipe(parse({ bom: true, delimiter: ';', columns: true }));

  const records: HistoryRawPoint[] = [];
  for await (const record of parser) {
    if (record['debut'] && record['kW']) {
      records.push(record as HistoryRawPoint);
    }
  }
  const intervalFrom = dayjs(records[0].debut).format('DD/MM/YYYY');
  const intervalTo = dayjs(records[records.length - 1].debut).format('DD/MM/YYYY');

  info(`Found ${records.length} data points from ${intervalFrom} to ${intervalTo} in CSV file`);

  return formatHistoryFile(records);
}
