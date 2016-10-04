'use strict';

var TDS = module.exports,
	Q = require('q'),
	_s = require("underscore.string"),
	path = require('path'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	utils = cb_require('utils/utils');

TDS.compile = function compile(data) {
	var deferred = Q.defer(),
		home = TDS.getHome(),
		cli = null;

	if (home === '') {
		deferred.reject(new Error("Variavel de ambiente 'TDS_HOME' nao definida!"));
		//utils.fail("Variavel de ambiente 'TDS_HOME' nao definida!");
	}
	else {
		console.log("Usando TDS_HOME='" + home + "'");

		cli = TDS.getCliExecutable(home);
	}

	if (cli === null) {
		deferred.reject(new Error("Não foi possivel encontrar o tdscli! Verifique se ele foi instalado!"));
	}
	else {
		var options = TDS.buildOptions(home, cli, 'compile', data),
			proc = spawn(options.cmd, options.args, {
				cwd: home,
				stdio: ['ignore', 'pipe', 'pipe']
			});

		proc.stdout.on('data', function(data) {
			var out = data.toString('utf8');
			out = out.replace(/^>>>>> Compil.*(.|[\r\n])*?>>>>\s*$/gm, "0");
			out = out.replace(/^>>>>.*(.|[\r\n])*?>>>>\s*$/gm, "");

			if (out.trim()) {
				console.log(out);
			}
		});

		proc.stderr.on('data', function(data) {
			var err = data.toString('ascii').replace(/^Warning: NLS unused message: (.*)$/gm, "");

			if (err.trim()) {
				console.error(err);
			}
		});

		proc.on('close', function(code) {
			if (code !== 0) {
				deferred.reject(new Error("Tdscli process exited with code " + code));
			}
			else {
				deferred.resolve();
			}
		});
	}

	return deferred.promise;
};


TDS.getHome = function getHome() {
	var home = process.env["TDS_HOME"];

	if (home === undefined) {
		return "";
	}

	home = path.normalize(home);
	if (!_s.endsWith(home, path.sep)) {
		home += path.sep;
	}

	return home;
};

TDS.getCliExecutable = function getCliExecutable(home) {
	var files = fs.readdirSync(home);

	for (var i = 0; i < files.length; i++) {
		if (_s.startsWith(files[i], "tdscli.")) {
			return files[i];
		}
	}

	return null;
};

TDS.buildOptions = function buildOptions(home, cli, target, data) {
	var opts = {
		cmd: home + cli,
		args: [],
		opts: {
			cwd: home
		}
	};

	opts.args.push(target);

	if (data.workspace) {
		opts.args.push("-data");
		opts.args.push(data.workspace);
		opts.args.push("workspace=true");
	}

	var keys = Object.keys(data);
	var index = keys.indexOf("workspace");
	if (index > -1) {
		keys.splice(index, 1);
	}

	keys.forEach(function(key, index) {
		var value = key + "=";

		if (Array.isArray(data[key])) {
			value += data[key].join(";");
		}
		else {
			value += data[key];
		}

		opts.args.push(value);
	});

	return opts;
};

