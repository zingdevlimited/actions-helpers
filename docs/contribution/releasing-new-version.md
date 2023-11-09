# Contribution - Releasing A New Version

Once you have merged your changes to main and tested them to ensure they all work, you need to do a [semver](https://semver.org/) version bump by updating 3 tags. With this method, any workflows that target the current major (e.g. `@v1`) should automatically receive any non-breaking changes.

Example: The current latest version tag is `v1.2.5`.

**If you are releasing a patch**:

```bash
git tag v1.2.6
git tag v1.2 --force
git tag v1 --force

git push --tags --force
```

**If you are releasing a minor**:

```bash
git tag v1.3.0
git tag v1.3
git tag v1 --force

git push --tags --force
```

**If you are releasing a major**:

```bash
git tag v2.0.0
git tag v2.0
git tag v2

git push --tags
```
