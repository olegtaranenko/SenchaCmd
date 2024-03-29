/*
 * This file contains helpful methods for writing Ant tasks in JavaScript. This file is
 * used by concat-ing it before the files that need it to pass to <scriptdef>.
 */

// Import the core Java packages:
importPackage(java.lang);
importPackage(java.io);
importPackage(java.net);
importPackage(javax.script);

var CR = String(System.getProperty('line.separator'));

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (callback, scope) {
        for (var array = this, i = 0, n = array.length; i < n; ++i) {
            callback.call(scope, array[i], i, array);
        }
    };
}

function applyTo (dest, src) {
    if (dest && src) {
        for (var name in src) {
            dest[name] = src[name];
        }
    }
    return dest;
}

function deleteFile (fileName) {
    try {
        new File(fileName)['delete']();
    } catch (e) {
        echo('Warning: Cannot delete "' + fileName + '"');
    }
}

/**
 * Writes the specified message to the log.
 * @param {String} message The message to log
 */
function echo (message) {
    self.log(message);
}

/**
 * Writes the specified message to the log and prefix it with the local time.
 * @param {String} message The message to log
 */

function echoWithTime(message) {
    var date = new Date();
    
    echo(date.toLocaleTimeString() + ' - ' + message);
}

var escapeXml = (function () {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
    };

    function replacer (m) {
        return map[m];
    }

    return function (string) {
        return String(string).replace(/[&<>'"]/g, replacer);
    };
}());

/**
 * JSON.decode/encode utilities functions
 */
var JSON = new(function() {
    var useHasOwn = !! {}.hasOwnProperty,
    pad = function(n) {
        return n < 10 ? "0" + n : n;
    },
    doDecode = function(json) {
        return eval("(" + json + ')');
    },
    doEncode = function(o) {
        if (typeof o == 'undefined' || o === null) {
            return "null";
        } else if (Object.prototype.toString.call(o) === '[object Array]') {
            return encodeArray(o);
        } else if (Object.prototype.toString.call(o) === '[object Date]') {
            return JSON.encodeDate(o);
        } else if (typeof o == 'string') {
            return encodeString(o);
        } else if (typeof o == 'number') {
            //don't use isNumber here, since finite checks happen inside isNumber
            return isFinite(o) ? String(o) : "null";
        } else if (typeof o == 'boolean') {
            return String(o);
        } else if (typeof o == 'object') {
            return encodeObject(o);
        } else if (typeof o === "function") {
            return encodeString(o.toString());
        }
        return 'undefined';
    },
    m = {
        "\b": '\\b',
        "\t": '\\t',
        "\n": '\\n',
        "\f": '\\f',
        "\r": '\\r',
        '"': '\\"',
        "\\": '\\\\',
        '\x0b': '\\u000b' //ie doesn't handle \v
    },
    charToReplace = /[\\\"\x00-\x1f\x7f-\uffff]/g,
    encodeString = function(s) {
        return '"' + s.replace(charToReplace, function(a) {
            var c = m[a];
            return (typeof c === 'string') ? c : ('\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4));
        }) + '"';
    },
    encodeArray = function(o) {
        var a = ["[", ""],
        // Note empty string in case there are no serializable members.
        len = o.length,
        i;
        for (i = 0; i < len; i += 1) {
            a.push(doEncode(o[i]), ',');
        }
        // Overwrite trailing comma (or empty string)
        a[a.length - 1] = ']';
        return a.join("");
    },
    encodeObject = function(o) {
        var a = ["{", ""],
        // Note empty string in case there are no serializable members.
        i;
        for (i in o) {
            if (typeof o[i] != 'function' && (!useHasOwn || o.hasOwnProperty(i))) {
                a.push(doEncode(i), ":", doEncode(o[i]), ',');
            }
        }
        // Overwrite trailing comma (or empty string)
        a[a.length - 1] = '}';
        return a.join("");
    };

    /**
     * <p>Encodes a Date. This returns the actual string which is inserted into the JSON string as the literal expression.
     * <b>The returned value includes enclosing double quotation marks.</b></p>
     * <p>The default return format is "yyyy-mm-ddThh:mm:ss".</p>
     * @param {Date} d The Date to encode
     * @return {String} The string literal to use in a JSON string.
     */
    this.encodeDate = function(o) {
        return '"' + o.getFullYear() + "-"
        + pad(o.getMonth() + 1) + "-"
        + pad(o.getDate()) + "T"
        + pad(o.getHours()) + ":"
        + pad(o.getMinutes()) + ":"
        + pad(o.getSeconds()) + '"';
    };

    /**
     * Encodes an Object, Array or other value
     * @param {Object} o The variable to encode
     * @return {String} The JSON string
     */
    this.encode = doEncode;


    /**
     * Decodes (parses) a JSON string to an object. If the JSON is invalid, this function throws a SyntaxError unless the safe option is set.
     * @param {String} json The JSON string
     * @param {Boolean} safe (optional) Whether to return null or throw an exception if the JSON is invalid.
     * @return {Object} The resulting object
     */
    this.decode = doDecode;

})();

/**
 * 
 * Advanced attributes.get wrapper that check that the value is not a property 
 * cast the result to a string and eventually fail the build if the attribute is 
 * not present.
 */
function getValueFromAttribute(name, fail) {
    var value = attributes.get(name) + '';
    
    if (!value || value == '' || value.match(/\$\{[^\}]*\}/)) {
        if (fail) {
            self.fail("Unable to find attribute " + name);
        }
        return null;
    } else {
        return value;
    }
}

/**
 * Executes a command given an object describing the application and arguments.
 * 
 *      exec({
 *          app: 'git',
 *          args: [ 'log', '-1', '--format=%H' ]
 *      });
 *
 *      // the above is equivalent to the following:
 *
 *      exec('git', ['log', '-1', '--format:%H']);
 * 
 * The important feature provided by this method (beyond convenience) is that the app name
 * (e.g., "git") is used to lookup an optional property (e.g., "x-git.exe"). That property
 * can be defined to deal with local path issues. When it is undefined, the raw app name is
 * used for the underlying exec task and must be found in the system path.
 * 
 * @param {Object/String} cmd An object describing the command.
 * @param {String} cmd.app The name of the application (e.g., "jsduck" or "git").
 * @param {String[]} cmd.args The arguments to pass to the application.
 * @param {Boolean} cmd.failOnError False to continue if the command fails (default is true).
 * @param {String[]} [args] The arguments to pass to the application.
 * @param {Object} [opt] Extra options (e.g., "failOnError").
 * @return {Object} The result of the command
 * @return {Number} return.exitCode The exit code of the command
 * @return {String} return.output The stdout generated from the command
 */
function exec (cmd, args, opt) {
    if (typeof cmd == 'string') {
        cmd = applyTo({
            app: cmd,
            args: args || []
        }, opt);
    }

    var task = project.createTask('exec'),
        exe = cmd.app,
        outProp = makeUniqueProperty(),
        resultProp = makeUniqueProperty(),
        arg;

    // The x-foo.exe property is needed if the app is not in the PATH (or you are on
    // Windows w/Cygwin or Mingw32 and the Unix-like PATH breaks the PATH search):
    //
    exe = project.getProperty('x-'+exe+'.exe') || exe;
    task.setExecutable(exe);
    task.setSearchPath(true);
    if (cmd.capture !== false) {
        // we sometimes need to not capture input our the child process may hang... it is
        // useful for simple tools only
        task.setOutputproperty(outProp);
    }
    task.setResultProperty(resultProp);
    task.setFailonerror(cmd.failOnError !== false);
    if (cmd.dir) {
        task.setDir(new File(project.resolveFile(cmd.dir)));
    }

    var path = new org.apache.tools.ant.types.Environment.Variable();
    path.setKey('PATH');
    // this ensures the separators are correct (Ant likes ';' even w/platform uses ':'):
    path.setPath(new org.apache.tools.ant.types.Path(project, project.getProperty('x-env.PATH')));
    task.addEnv(path);

    for (var i = 0, n = cmd.args.length; i < n; ++i) {
        arg = task.createArg();
        arg.setValue(cmd.args[i]);
    }

    echo(exe + ' ' + cmd.args.join(' '));
    task.execute();
    return {
        exitCode: project.getProperty(resultProp),
        output: project.getProperty(outProp)
    };
}

function getCurrentCommitHash () {
    return exec('git', ['log', '-1', '--format=%H']).output;
}

function makeUniqueProperty () {
    var i = 0,
        prop;

    do {
        prop = 'x-genprop-' + (++i);
    } while (project.getProperty(prop + '-taken'));

    project.setProperty(prop + '-taken', '1');
    return prop;
}

/**
 * Makes the URL as described by the params.
 * @param {Object} params The parameters for the task
 * @param {String} params.host The host (machine name or IP address) of the URL.
 * @param {String} [params.scheme="http"] The protocol of the URL (e.g., "https").
 * @param {int} [params.port] The port number
 * @param {String} [params.path="/"] The path of the URL.
 * @param {String[]} [params.query] The query parameters of the URL.
 * @param {String} [params.fragment] The fragment of the URL.
 * @return {String} The URL
 */
function makeUrl (params) {
    var uri = new URI(params.scheme || 'http',
                      null,
                      params.host,
                      Number(params.port) || -1, // on Mac, null||-1 is a boolean!
                      params.path || '/',
                      null, null),
        url = String(uri.toString());

    if (params.query.length) {
        for (var a = [], i = 0, q = params.query, n = q.length; i < n; ++i) {
            if (typeof q[i] == 'string') {
                a.push(q[i]);
            } else {
                a.push((q[i].name + '=' + encodeURIComponent(q[i].value)));
            }
        }

        url += '?' + a.join('&');
    }

    if (params.fragment) {
        url += '#' + params.fragment;
    }

    //self.log(url);
    return url;
}

/**
 * Creates the specified directory or directories if multiple need to be created. The goal
 * being to ensure that the specified directory exists if at all possible.
 * 
 * @param {String} dir The name of the directory to create
 * @return {String} The full path to the directory
 */
function mkdir (dir) {
    var task = project.createTask("mkdir"),
        resolvedDir = project.resolveFile(dir);

    task.dir = resolvedDir;
    task.execute();

    return resolvedDir.toString();
}

function parseBool (bool) {
    return /true|yes|on|1|y/i.test(String(bool));
}

/**
 * Splits a set of paths (filenames) into an array. These paths should be separated by the
 * platform's path separator (typically, ';' or ':').
 * @param {String} paths The paths string to split
 * @param {String} sep The path separator
 * @return {String[]} The paths as individual strings.
 */
function splitPaths (paths, sep) {
    if (paths.indexOf(sep) >= 0) {
        return paths.split(sep);
    }

    // On Linux, the Java File.pathSeparator is ":", but Ant still uses ";"
    if (sep == ':' && paths.indexOf(';') >= 0) {
        return paths.split(';');
    }

    return [ paths ];
}

/**
 * Read the specified file and return an array of lines.
 * @param {String} fileName The file name
 * @param {Boolean} failIfNotFound False to return null if file not found (default is true).
 * @return {String[]} The array containing the lines of the file or null.
 */
function readLines (fileName, failIfNotFound) {
    var f, lines = [ ], s;

    try {
        f = new BufferedReader(new FileReader(fileName));
        while ((s = f.readLine()) !== null) {
            lines.push(String(s));
        }
    } catch (e) {
        if (failIfNotFound === false) {
            return null;
        }
        self.fail('Cannot read file: ' + fileName + ': ' + e.message);
    } finally {
        if (f) {
            f.close();
        }
    }

    return lines;
}

/**
 * Read the specified file and returns the file as a single string.
 * @param {String} fileName The file name
 * @param {Boolean} failIfNotFound False to return null if file not found (default is true).
 * @return {String} The string with the content of the file or null.
 */
function readFile (fileName, failIfNotFound) {
    var lines = readLines(fileName, failIfNotFound);
    return lines && lines.join('\n');
}

/**
 * Writes the specified string to a file.
 * @param {String} fileName The file name
 * @param {String} text The string with the content of the file
 */
function writeFile (fileName, text) {
    var f;

    try {
        f = new FileWriter(fileName);
        f.write(text, 0, text.length);
    } catch (e) {
        self.fail('Cannot write file: ' + fileName + ': ' + e.message);
    } finally {
        if (f) {
            f.close();
        }
    }
}

/**
 * Writes the specified array of lines to a file.
 * @param {String} fileName The file name
 * @param {String[]} lines The array containing the lines of the file
 */
function writeLines (fileName, lines) {
    writeFile(fileName, lines.join(CR));
}

function xpathFind (node, xpath, type) {
    var child = xpathFindNodes(node, xpath, type || 'NODE');
    return child ? child.getNodeValue() : null;
}

var xpathCache = {};
function xpathFindNodes (node, xpath, type) {
    var xp = xpathCache[xpath];
    if (!xp) {
        var factory = javax.xml.xpath.XPathFactory.newInstance(),
            instance = factory.newXPath();
        xpathCache[xpath] = xp = instance.compile(xpath);
    }
    return xp.evaluate(node, XPathConstants[type || 'NODESET']);
}

//-----------------------------------------------------------------------------

/**
 * This class provides an iterator of a set of single file or directory elements.
 */
function FileSequence (config) {
    applyTo(this, config);

    this.index = 0;
    this.count = this.dirs ? this.dirs.size() : 0;
}

FileSequence.prototype = {
    /**
     * @cfg
     * The name of the attribute on each element that contains the path.
     */
    attr: 'path',

    append: function (seq) {
        return new UnionSequence({
            sets: [this, seq]
        });
    },

    next: function () {
        var dir = this.peek();
        this.currentDir = null; // forces us to advance
        return dir;
    },

    peek: function () {
        var currentDir = this.currentDir;

        if (!currentDir && this.index < this.count) {
            var dir = this.dirs.get(this.index++);
            dir = dir.getRuntimeConfigurableWrapper();

            currentDir = project.resolveFile(dir.getAttributeMap().get(this.attr));

            this.currentDir = currentDir;
        }

        return currentDir;
    }
};

//-----------------------------------------------------------------------------

/**
 * This class provides an iterator of the files in a set of filesets.
 */
function FileSetSequence (config) {
    applyTo(this, config);

    this.pathSep = String(File.pathSeparator);
    this.fileSep = String(File.separator);
    this.fileSetIndex = 0;
    this.nameIndex = 0;
    this.numFileSets = this.fileSets ? this.fileSets.size() : 0;
}

FileSetSequence.prototype = {
    append: function (seq) {
        return new UnionSequence({
            sets: [this, seq]
        });
    },

    next: function () {
        var file = this.peek();
        this.currentFile = null; // forces us to advance
        return file;
    },

    peek: function () {
        var currentFile = this.currentFile;

        if (!currentFile) {
            var fileNames = this.fileNames;

            // This is a loop since a fileset can be empty...
            while (!fileNames || this.nameIndex == fileNames.length) {
                if (this.fileSetIndex == this.numFileSets) {
                    return null;
                }

                var fileSet = this.fileSets.get(this.fileSetIndex++);

                if (this.dirsOnly) {
                    fileNames = [''];
                } else {
                    fileNames = splitPaths(String(fileSet), this.pathSep);
                }

                this.currentDir = fileSet.getDir(project) + this.fileSep;
                this.fileNames = fileNames;
                this.nameIndex = 0;
            }

            this.currentFile = currentFile = this.currentDir + fileNames[this.nameIndex++];
        }

        return currentFile;
    }
};

//-----------------------------------------------------------------------------

/**
 * This class provides an iterator over a set of iteratable collections.
 */
function UnionSequence (config) {
    applyTo(this, config);
    this.index = 0;
}

UnionSequence.prototype = {
    append: function (seq) {
        this.sets.push(seq);
        return this;
    },

    next: function () {
        var ret = this.peek();
        this.current = null;
        return ret;
    },

    peek: function () {
        var current = this.current;

        while (!current && this.index < this.sets.length) {
            current = this.sets[this.index].next();
            if (!current) {
                ++this.index;
            }
        }

        return current;
    }
};

/**
 * 
 * Small utility class that extract github user and repo from a git url
 */

Github = {
    
    httpRe: /https:\/\/[^@]+@github.com\/([^\/]+)\/([^\.]+).git/,
    
    gitRe: /git@github.com:([^\/]+)\/([^\.]+).git/,
    
    extract: function(url) {
        var match = url.match(this.httpRe) || url.match(this.gitRe);
        if (match && match.length == 3) {
            return {
                user: match[1],
                repo: match[2]
            }
        }
        
        return match;
    },
       
    extractUser: function(url) {
        var extract = this.extract(url);
        if (extract === null) {
            self.fail("Github.extractUser: Unable to extract user from git url " + url);
        }
        
        return extract.user;
    },
    
    extractRepo: function(url) {
        var extract = this.extract(url);
        if (extract === null) {
            self.fail("Github.extractRepo: Unable to extract repo from git url " + url);
        }
        
        return extract.repo;
    }
};/*
 * This file contains the guts of the <x-escape> task.
 */

(function () {
    var string = attributes.get('string')+'',
        property = attributes.get('property'),
        varname = attributes.get('var'),
        type = attributes.get('type')+'';

    switch (type) {
        case 'json':
            string = JSON.encode(string);
            string = string.substring(1, string.length-1);
            break;
        case 'xml':
            string = escapeXml(string);
            break;
    }

    if (property && !project.getProperty(property)) {
        project.setProperty(property, string);
    }

    if (varname) {
        project.setProperty(varname, string);
    }
})();
