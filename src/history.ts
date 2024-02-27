import { readdirSync, createReadStream, existsSync } from 'node:fs';
import { debug, info, error } from './log.js';
import { parse } from 'csv-parse';
import { EnergyDataPoint, formatLoadCurve, formatToEnergy } from './format.js';
import dayjs from 'dayjs';

const baseDir = '/config';
const userDir = '/addon_configs/cf6b56a3_linky';

export async function getMeterHistory(prm: string): Promise<EnergyDataPoint[]> {
  if (!existsSync(baseDir)) {
    debug(`Cannot find folder ${userDir}`);
    return;
  }
  const files = readdirSync(baseDir).filter((file) => file.endsWith('.csv'));
  debug(`Found ${files.length} CSV ${files.length > 1 ? 'files' : 'file'} in ${userDir}`);

  for (const filename of files) {
    try {
      const metadata = await readMetadata(filename);

      if (metadata['Identifiant PRM'] && metadata['Identifiant PRM'] === prm) {
        return readHistory(filename);
      }
    } catch (e) {
      error(`Error while reading ${filename}: ${e.toString()}`);
    }
  }
  return [];
}

async function readMetadata(filename: string): Promise<{ [key: string]: string }> {
  const parser = createReadStream(`${baseDir}/${filename}`).pipe(
    parse({ bom: true, delimiter: ';', columns: true, toLine: 2 }),
  );
  for await (const record of parser) {
    return record;
  }
}

async function readHistory(filename: string): Promise<EnergyDataPoint[]> {
  info(`Importing historical data from ${filename}`);

  const parser = createReadStream(`${baseDir}/${filename}`).pipe(
    parse({ bom: true, delimiter: ';', columns: true, fromLine: 3 }),
  );

  const records: { date: string; value: string }[] = [];
  for await (const record of parser) {
    if (record['Horodate'] && record['Valeur']) {
      records.push({
        date: record['Horodate'],
        value: record['Valeur'],
      });
    }
  }

  const intervalFrom = dayjs(records[0].date).format('DD/MM/YYYY');
  const intervalTo = dayjs(records[records.length - 1].date).format('DD/MM/YYYY');

  info(`Found ${records.length} data points from ${intervalFrom} to ${intervalTo} in CSV file`);

  const loadCurve = formatLoadCurve(records);
  return formatToEnergy(loadCurve);
}
