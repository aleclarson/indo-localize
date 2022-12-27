# indo-localize

For recursive localizing the `vendor/` folders of any number of [indo](https://github.com/alloc/indo) repositories that are linked together.

Localizing involves resolving any symlinked packages found in `vendor/` and replacing those symlinks with the real contents of each package by copying every file within each package.

```sh
# The given folder should have a "vendor" subfolder.
indo-localize ./

# Replace the localized packages with symlinks.
indo-localize revert ./
```
