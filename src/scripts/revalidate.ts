// This command will revalidate all computations in the database. This means it
// will ensure they are still valid, and replace them if not.

import { Command } from 'commander'
import { Op } from 'sequelize'

import { loadConfig } from '@/core'
import { Computation, Event, loadDb } from '@/db'

const LOADER_MAP = ['—', '\\', '|', '/']

const main = async () => {
  // Parse arguments.
  const program = new Command()
  program.option(
    '-c, --config <path>',
    'path to config file, falling back to config.json'
  )
  program.option(
    '-b, --batch <size>',
    'batch size',
    (value) => parseInt(value, 10),
    10000
  )
  program.parse()
  const { config, batch } = program.opts()

  console.log(`\n[${new Date().toISOString()}] Revalidating computations...`)

  // Load config with config option.
  loadConfig(config)

  // Load DB on start.
  const sequelize = await loadDb()

  let latestId = 0
  let updated = 0
  let replaced = 0

  const total = await Computation.count()

  // Print latest statistics every 100ms.
  let printLoaderCount = 0
  const printStatistics = () => {
    printLoaderCount = (printLoaderCount + 1) % LOADER_MAP.length
    process.stdout.write(
      `\r${LOADER_MAP[printLoaderCount]}  Processed: ${(
        updated + replaced
      ).toLocaleString()}. Updated/replaced: ${updated.toLocaleString()}/${replaced.toLocaleString()}. Total: ${total.toLocaleString()}.`
    )
  }
  const logInterval = setInterval(printStatistics, 100)
  // Allow process to exit even though this interval is alive.
  logInterval.unref()

  while (updated + replaced < total) {
    const computations = await Computation.findAll({
      where: {
        id: {
          [Op.gt]: latestId,
        },
      },
      limit: batch,
      order: [['id', 'ASC']],
    })

    // If there are no more computations, we're done.
    if (computations.length === 0) {
      break
    }

    latestId = computations[computations.length - 1].id

    const revalidations = await Promise.all(
      computations.map((computation) => computation.revalidate())
    )

    updated += revalidations.reduce((acc, valid) => acc + (valid ? 1 : 0), 0)
    replaced += revalidations.reduce((acc, valid) => acc + (valid ? 0 : 1), 0)
  }

  clearInterval(logInterval)

  printStatistics()
  console.log(`\n[${new Date().toISOString()}] Revalidation complete.`)

  await sequelize.close()

  process.exit(0)
}

main()
