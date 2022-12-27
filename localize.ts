import fs from 'fs'
import { join } from 'path'
import exec from '@cush/exec'
import { blue, green, red } from 'kleur/colors'
import { copy, follow, isDir, isLink, remove } from 'saxon/sync'

if (exec.sync('which ni', { noThrow: true }).length == 0) {
  console.error('You must run "pnpm i -g @antfu/ni" first.')
  process.exit(1)
}

localizeVendor(process.argv[2])

function localizeVendor(root: string) {
  const vendorRoot = join(root, 'vendor')
  if (!isDir(vendorRoot)) {
    return
  }

  console.log(green('Localizing:'), vendorRoot)
  const dirs = new Set(
    fs.readdirSync(vendorRoot).filter(file => file[0] != '.')
  )

  for (const dir of [...dirs]) {
    if (dir[0] == '@') {
      dirs.delete(dir)
      try {
        fs.readdirSync(join(vendorRoot, dir)).forEach(file => {
          if (file[0] != '.') {
            dirs.add(join(dir, file))
          }
        })
      } catch (e: any) {
        console.error(red('Failed to read dir "%s":'), dir, e.message)
      }
    }
  }

  const vendorHistory = join(vendorRoot, '.history')
  fs.mkdirSync(vendorHistory, { recursive: true })

  const resolvedDirs = new Set<string>()
  for (let dir of dirs) {
    const unresolvedDir = join(vendorRoot, dir)

    let resolvedDir: string
    try {
      resolvedDir = follow(unresolvedDir, true)
    } catch (e: any) {
      console.error(red('Failed to resolve "%s":\n  '), dir, e.message)
      continue
    }

    if (isLink(unresolvedDir)) {
      resolvedDirs.add(resolvedDir)

      // Save symlink for undo purposes.
      try {
        fs.unlinkSync(join(vendorHistory, dir))
      } catch {}
      fs.cpSync(unresolvedDir, join(vendorHistory, dir))

      console.log(blue('Copying dependency:'), dir)

      // Convert the directory symlink into a copy of the real
      // directory.
      remove(unresolvedDir)
      copy(resolvedDir, unresolvedDir)
    } else {
      resolvedDirs.add(join(vendorRoot, dir))
    }

    // Check node_modules for symlinks.
    const nodeModules = join(resolvedDir, 'node_modules')
    if (isDir(nodeModules)) {
      // If a dependency symlink points outside the resolved directory
      // or the symlink is just plain broken, re-install dependencies.
      const needsReinstall = fs.readdirSync(nodeModules).some(file => {
        if (file[0] != '.' && isLink(join(nodeModules, file))) {
          try {
            const resolvedDep = follow(join(nodeModules, file), true)
            if (!resolvedDep.startsWith(resolvedDir)) {
              return true
            }
          } catch {
            return true
          }
        }
      })
      if (needsReinstall) {
        console.log(
          blue('Re-installing dependencies:') + '\n  %s\n',
          unresolvedDir
        )
        remove(join(unresolvedDir, 'node_modules'), true)
        exec.sync('ni', {
          cwd: unresolvedDir,
          stdio: 'inherit',
          noThrow: true,
        })
      }
    }
  }

  resolvedDirs.forEach(localizeVendor)
}
