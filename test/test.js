const should = require('should')
const p = require('path')
const fs = require('fs')
const request = require('supertest')
const sinon = require('sinon')
const dafuq = require(process.env['DAFUQ_COVERAGE'] ? '../src-cov' : '../src')

describe('Constructor', function() {

    const build = function(opts) {
        return function() {
            return dafuq(opts)
        }
    }

    it('should throw if no path is provided',  function() {
        build().should.throw(/path/);
    })

    it('should throw if path is not a valid string',  function() {
        build({ path: ''}).should.throw(/path/);
        build('').should.throw(/path/);
        build({ path: undefined }).should.throw(/path/);
        build(undefined).should.throw(/path/);
        build({ path: null }).should.throw(/path/);
        build(null).should.throw(/path/);
        build({ path: 1 }).should.throw(/path/);
        build(1).should.throw(/path/);
        build({ path: {} }).should.throw(/path/);
        build({}).should.throw(/path/);
        build({ path: [] }).should.throw(/path/);
        build([]).should.throw(/path/);
    })

    it('should throw if path points to a non existant directory',  function() {
        build({ path: '/dev/null' }).should.throw(/path/);
        build('/dev/null').should.throw(/path/);
        build({ path: './doesnotexist' }).should.throw(/path/);
        build('./doesnotexist').should.throw(/path/);
    })

    it('should throw if path points to a file',  function() {
        build({ path: __filename }).should.throw(/path/);
    })

    it('should work with a valid relative directory', () => {
        build({ path: '../test/commands' }).should.not.throw();
        build({ path: './commands' }).should.not.throw();
    })

    it('should work with a valid absolute directory', () => {
        build({ path: p.resolve(__dirname, './commands') }).should.not.throw();
    })

    it('should throw if shebang is not a valid string',  function() {
        build({
            path: './commands',
            bearer: 'shebang'
        }).should.not.throw(/shebang/);
        build({
            path: './commands',
            shebang: 1
        }).should.throw(/shebang/);
        build({
            path: './commands',
            shebang: {}
        }).should.throw(/shebang/);
        build({
            path: './commands',
            shebang: []
        }).should.throw(/shebang/);
    })

    it('should throw if bearer is not a valid string',  function() {
        build({
            path: './commands',
            bearer: 'token'
        }).should.not.throw(/bearer/);
        build({
            path: './commands',
            bearer: 1
        }).should.throw(/bearer/);
        build({
            path: './commands',
            bearer: {}
        }).should.throw(/bearer/);
        build({
            path: './commands',
            bearer: []
        }).should.throw(/bearer/);
    })

    it('should throw if timeout is not a valid number',  function() {
        build({
            path: './commands',
            timeout: 1
        }).should.not.throw(/timeout/);
        build({
            path: './commands',
            timeout: '1'
        }).should.throw(/timeout/);
        build({
            path: './commands',
            timeout: {}
        }).should.throw(/timeout/);
        build({
            path: './commands',
            timeout: []
        }).should.throw(/timeout/);
    })

    it('should throw if debug is not a function',  function() {
        build({
            path: './commands',
            debug: function() {}
        }).should.not.throw();
        build({
            path: './commands',
            debug: false
        }).should.throw();
        build({
            path: './commands',
            debug: true
        }).should.throw();
        build({
            path: './commands',
            debug: ''
        }).should.throw(/debug/);
        build({
            path: './commands',
            debug: 'string'
        }).should.throw(/debug/);
        build({
            path: './commands',
            debug: 123
        }).should.throw(/debug/);
        build({
            path: './commands',
            debug: {}
        }).should.throw(/debug/);
        build({
            path: './commands',
            debug: []
        }).should.throw(/debug/);
    })

    it('should throw if middlewares is not an array of functions',  function() {
        build({
            path: './commands',
            middlewares: []
        }).should.not.throw();
        build({
            path: './commands',
            middlewares: true
        }).should.throw(/middlewares/);
        build({
            path: './commands',
            middlewares: function() {}
        }).should.throw(/middlewares/);
        build({
            path: './commands',
            middlewares: ''
        }).should.throw(/middlewares/);
        build({
            path: './commands',
            middlewares: 'string'
        }).should.throw(/middlewares/);
        build({
            path: './commands',
            middlewares: 123
        }).should.throw(/middlewares/);
        build({
            path: './commands',
            middlewares: {}
        }).should.throw(/middlewares/);
        // Arrays of
        build({
            path: './commands',
            middlewares: [ () => {} ]
        }).should.not.throw();
        build({
            path: './commands',
            middlewares: [ true ]
        }).should.throw();
        build({
            path: './commands',
            middlewares: [ '' ]
        }).should.throw();
        build({
            path: './commands',
            middlewares: [ 'string' ]
        }).should.throw();
        build({
            path: './commands',
            middlewares: [ 123 ]
        }).should.throw();
        build({
            path: './commands',
            middlewares: [ {} ]
        }).should.throw();
    })

    it('should throw if env is not an object',  function() {
        build({
            path: './commands',
            env: {}
        }).should.not.throw();
        build({
            path: './commands',
            env: false
        }).should.throw(/env/);
        build({
            path: './commands',
            env: true
        }).should.throw(/env/);
        build({
            path: './commands',
            env: function() {}
        }).should.throw();
        build({
            path: './commands',
            env: ''
        }).should.throw(/env/);
        build({
            path: './commands',
            env: 'string'
        }).should.throw(/env/);
        build({
            path: './commands',
            env: 123
        }).should.throw(/env/);
        build({
            path: './commands',
            env: []
        }).should.throw(/env/);
    })
})

describe('Invoking a file', () => {
    describe('specifing path', () => {
        let app;
        before(function() {
            app = dafuq({ path: './commands' });
        })

        it('should return success true after executing the command', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.success.should.be.true() )
                .end(done)
        })

        it('should return success true on the X-Success header after executing the command', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect('X-Success', 'true')
                .end(done)
        })

        it('should return the output of executing the command', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal('Hello World'))
                .end(done)
        })

        it('should return success false if command exits with code 11', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.success.should.be.false())
                .end(done)
        })

        it('should return success false on the X-Succes header if command exits with code 11', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect('X-Success', 'false')
                .end(done)
        })

        it('should return the stderr output of executing the command even when it exits with code 11', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.message.should.be.equal('Bye World'))
                .end(done)
        })

        it('should return the stderr output of executing the command even when it exits with code != 11 as plain text and 500', (done) => {
            request(app)
                .get('/critical')
                .expect(500)
                .expect('Content-Type', /plain/)
                .expect(res => {
                    should(res.serverError).be.true()
                    should(res.error.text).containEql('I did nothing wrong')
                })
                .end(done)
        })

        it('should return the parsed output of executing a command that outputs JSON', (done) => {
            request(app)
                .get('/json')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => { res.body.success.should.be.true() })
                .expect(res => res.body.result.should.be.eql({ 'foo': 'bar' }))
                .end(done)
        })

        it('should return the parsed output of executing a command that outputs JSON and has success', (done) => {
            request(app)
                .get('/json-fail')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => { res.body.success.should.be.false() })
                .expect(res => res.body.result.should.be.eql({ 'foo': 'bar' }))
                .end(done)
        })

        it('should return a download file when file exits with code 10', (done) => {
            request(app)
                .get('/download')
                .expect(200)
                .expect('Content-Disposition', /attachment/)
                .expect('X-Success', 'true')
                .expect(res => res.text.should.not.be.empty())
                .end(done)
        })

        it('should upload a file and pass its path to the command', (done) => {
            request(app)
                .post('/multipart')
                .attach('file', __filename)
                .expect(200)
                .expect(res => {
                    res.body.result.should.be.equal(fs.readFileSync(__filename, 'utf-8').trim())
                })
                .end(done)
        })

        it('should upload a file to a path containing the original file name', (done) => {
            request(app)
                .post('/multipart-filename')
                .attach('file', __filename)
                .expect(200)
                .expect(res => {
                    res.body.result.should.endWith(p.basename(__filename))
                })
                .end(done)
        })

        it('should not create a route when a file doesn\'t have execute permissions', (done) => {
            request(app)
                .get('/no-exec')
                .expect(404)
                .end(done)
        })
    })

    describe('specifing bearer', () => {
        let app;
        const token = 'klr5udmm-qc7g-2ndh-98v2-qjn5039avxqn'

        before(function() {
            app = dafuq({
                path: './commands',
                bearer: token
            });
        })

        it('should forbid access if no token on the request', (done) => {
            request(app)
                .get('/hello')
                .expect(401)
                .end(done)
        })

        it('should allow access if token on the query', (done) => {
            request(app)
                .get('/hello')
                .query({ 'access_token': token })
                .expect(200)
                .end(done)
        })

        it('should allow access if token on the body', (done) => {
            request(app)
                .post('/hello')
                .send({ 'access_token': token })
                .expect(200)
                .end(done)
        })

        it('should allow access if token on the header', (done) => {
            request(app)
                .get('/hello')
                .set('Authorization', 'Bearer ' + token)
                .expect(200)
                .end(done)
        })
    })

    describe('specifing timeout', () => {
        let app;

        before(function() {
            app = dafuq({
                path: './commands',
                timeout: 500
            });
        })

        it('should kill the process if takes longer than the timeout', (done) => {
            request(app)
                .get('/hangup')
                .expect(500)
                .expect('Content-Type', /text/)
                .expect(res => res.body.should.match(/timeout/))
                .end(done)
        })
    })

    describe('specifing shebang', () => {

        let app;
        before(function() {
            app = dafuq({
                path: './commands',
                shebang: p.join(__dirname, 'node')
            });
        })

        it('should create a route even when a file doesn\'t have execute permissions', (done) => {
            request(app)
                .get('/no-exec')
                .expect(200)
                .expect(res => res.body.result.should.be.equal('I\'m not executable'))
                .end(done)
        })
    })

    describe('specifing middlewares', () => {
        let app, spy1, spy2;

        before(() => {
            spy1 = sinon.stub().callsArg(2)
            spy2 = sinon.stub().callsArg(2)
            app = dafuq({
                path: './commands',
                middlewares: [ spy1, spy2 ]
            });
        })

        beforeEach(() => {
            spy1.reset()
            spy2.reset()
        })

        it('calls each middleware once in order of definition', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(() => {
                    spy1.calledOnce.should.be.true()
                    spy2.calledOnce.should.be.true()
                    spy1.calledBefore(spy2)
                })
                .end(done)
        })

        it('response object has a "dafuq" property (a.k.a. res.dafuq)', (done) => {
            request(app)
                .get('/hello')
                .expect(response => {
                    const [ req, res, next ] = spy1.args[0]
                    should(res).have.property('dafuq')
                })
                .end(done)
        })

        it('res.dafuq has "type" and "output" properties', (done) => {
            request(app)
                .get('/hello')
                .expect(response => {
                    const [ req, res, next ] = spy1.args[0]
                    should(res.dafuq).have.properties([ 'type', 'output' ])
                })
                .end(done)
        })

        it('res.dafuq has "error" property when command fails', (done) => {
            request(app)
                .get('/critical')
                .expect(response => {
                    const [ req, res, next ] = spy1.args[0]
                    should(res.dafuq).have.property('error')
                })
                .end(done)
        })

    })

    describe('specifing env', () => {
        let app;

        before(function() {
            app = dafuq({
                path: './commands',
                env: {
                    HELLO_NAME: 'Jhon'
                }
            });
        })

        it('should read the defined environment variables', (done) => {
            request(app)
                .get('/envecho')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal("Hello Jhon"))
                .end(done)
        })

        it('should read other environment variables already defined', (done) => {
            process.env['NODE_HELLO_NAME'] = 'Marc'
            request(app)
                .get('/envecho')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal("Hello Marc"))
                .end(done)
        })
    })

})

describe('Arguments', () => {

    let app;
    before(function() {
        app = dafuq({ path: './commands' });
    })

    it('should pass url params (from directories starting with colon) as command line arguments', (done) => {
        request(app)
            .get('/hello/Jhon')
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Jhon"))
            .end(done)
    })

    it('should pass query params as command line arguments', (done) => {
        request(app)
            .get('/hello')
            .query({ name: 'Jhon'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Jhon"))
            .end(done)
    })

    it('should pass json body members as command line arguments', (done) => {
        request(app)
            .post('/hello')
            .send({ name: 'Jhon'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Jhon"))
            .end(done)
    })

    it('should pass form-url-encoded body members as command line arguments', (done) => {
        request(app)
            .post('/hello')
            .type('form')
            .send({ name: 'Jhon' })
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Jhon"))
            .end(done)
    })

    it('should pass X-Arg headers as command line arguments', (done) => {
        request(app)
            .get('/hello')
            .set('X-Arg-name', 'Jhon')
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Jhon"))
            .end(done)
    })

    it('should pass arguments containing blank spaces', (done) => {
        request(app)
            .get('/hello')
            .query({ name: 'Sarah Connor'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Sarah Connor"))
            .end(done)
    })

    it('should pass arguments containing double quotes', (done) => {
        request(app)
            .get('/hello')
            .query({ name: 'Sarah "Connor"'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Sarah \"Connor\""))
            .end(done)
    })

    it('should pass arguments containing backslashes', (done) => {
        request(app)
            .get('/hello')
            .query({ name: 'Sarah\\ Connor'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal("Hello Sarah\\ Connor"))
            .end(done)
    })

    it('should pass arguments containing backslashes and double quotes', (done) => {
        request(app)
            .get('/hello')
            .query({ name: 'Sarah \\"Connor\\"'})
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal('Hello Sarah \\"Connor\\"'))
            .end(done)
    })

    it('should pass complex json as flattened paths', (done) => {
        const body = {
            names: [
                'Sarah',
                'Arnold'
            ],
            surnames: [
                'Connor',
                'Swacheneger'
            ],
            films: {
                'terminator': 9
            }
        }
        const expectedBody = [
            'names.0:Sarah',
            'names.1:Arnold',
            'surnames.0:Connor',
            'surnames.1:Swacheneger',
            'films.terminator:9'
        ].join('\n')

        request(app)
            .post('/json')
            .send(body)
            .expect(200)
            .expect('Content-Type', /json/)
            .expect(res => res.body.result.should.be.equal(expectedBody))
            .end(done)
    })
})
