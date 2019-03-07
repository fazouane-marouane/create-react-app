const globbySync = require('globby').sync;
const loadJsonFileSync = require('load-json-file').sync;
const path = require('path');
const ValidationError = require('@lerna/validation-error');
const Package = require('@lerna/package');

function flattenResults(results) {
  return results.reduce((acc, result) => acc.concat(result), []);
}

function makeFileFinderSync(rootPath, packageConfigs) {
  const globOpts = {
    cwd: rootPath,
    absolute: true,
    followSymlinkedDirectories: false,
    // POSIX results always need to be normalized
    transform: fp => path.normalize(fp),
  };

  if (packageConfigs.some(cfg => cfg.indexOf('**') > -1)) {
    if (packageConfigs.some(cfg => cfg.indexOf('node_modules') > -1)) {
      throw new ValidationError('EPKGCONFIG', 'An explicit node_modules package path does not allow globstars (**)');
    }

    globOpts.ignore = [
      // allow globs like "packages/**",
      // but avoid picking up node_modules/**/package.json
      '**/node_modules/**',
    ];
  }

  return (fileName, fileMapper, customGlobOpts) => {
    const options = Object.assign({}, customGlobOpts, globOpts);
    const packages = packageConfigs.sort().map((globPath) => {
      const results = globbySync(path.join(globPath, fileName), options).sort();

      if (fileMapper) {
        return fileMapper(results);
      }

      return results;
    });

    // always flatten the results
    return flattenResults(packages);
  };
}

module.exports.makeFileFinderSync = makeFileFinderSync;

module.exports.getPackagesSync = function getPackagesSync(project) {
  const mapper = (packageConfigPath) => {
    const packageJson = loadJsonFileSync(packageConfigPath);
    return new Package(packageJson, path.dirname(packageConfigPath), project.rootPath);
  };

  const finder = makeFileFinderSync(project.rootPath, project.packageConfigs);

  return finder('package.json', filePaths => filePaths.map(mapper));
};
