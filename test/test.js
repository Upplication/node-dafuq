require('should')
const p = require('path')
const fs = require('fs')
const request = require('supertest');
const dafuq = require(process.env['DAFUQ_COVERAGE'] ? '../src-cov' : '../src')

describe('Constructor', function() {

    it('should throw if no path is provided',  function() {
        (() => dafuq()).should.throw(/path/);
    })

    it('should throw if path is not a valid string',  function() {
        (() => dafuq({ path: ''})).should.throw(/path/);
        (() => dafuq('')).should.throw(/path/);
        (() => dafuq({ path: undefined })).should.throw(/path/);
        (() => dafuq(undefined)).should.throw(/path/);
        (() => dafuq({ path: null })).should.throw(/path/);
        (() => dafuq(null)).should.throw(/path/);
        (() => dafuq({ path: 1 })).should.throw(/path/);
        (() => dafuq(1)).should.throw(/path/);
        (() => dafuq({ path: {} })).should.throw(/path/);
        (() => dafuq({})).should.throw(/path/);
        (() => dafuq({ path: [] })).should.throw(/path/);
        (() => dafuq([])).should.throw(/path/);
    })

    it('should throw if path points to a non existant directory',  function() {
        (() => dafuq({ path: '/dev/null' })).should.throw(/path/);
        (() => dafuq('/dev/null')).should.throw(/path/);
        (() => dafuq({ path: './doesnotexist' })).should.throw(/path/);
        (() => dafuq('./doesnotexist')).should.throw(/path/);
    })

    it('should throw if path points to a file',  function() {
        (() => dafuq({ path: __filename })).should.throw(/path/);
    })

    it('should work with a valid relative directory', () => {
        (() => dafuq({ path: '../test/commands' })).should.not.throw();
        (() => dafuq({ path: './commands' })).should.not.throw();
    })

    it('should work with a valid absolute directory', () => {
        (() => dafuq({ path: p.resolve(__dirname, './commands') })).should.not.throw();
    })
})

describe('Invoking a file', () => {
    describe('without shebang', () => {
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

        it('should return the output of executing the command', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal('Hello World'))
                .end(done)
        })

        it('should return success false if command exits with code different from 0', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.success.should.be.false())
                .end(done)
        })

        it('should return the output of executing the command even when it exits with code different from 0', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal('Bye World'))
                .end(done)
        })

        it('should return a download file when file exits with code 10', (done) => {
            request(app)
                .get('/download')
                .expect(200)
                .expect('Content-Disposition', /attachment/)
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

        it('should not create a route when a file doesn\'t have execute permissions', (done) => {
            request(app)
                .get('/no-exec')
                .expect(404)
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

        it('should return success true after executing the command', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.success.should.be.true() )
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

        it('should return the output of executing the command when not specifing extension', (done) => {
            request(app)
                .get('/hello')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal('Hello World'))
                .end(done)
        })

        it('should return success false if command exits with code different from 0', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.success.should.be.false())
                .end(done)
        })

        it('should return the output of executing the command even when it exits with code different from 0', (done) => {
            request(app)
                .get('/bye')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => res.body.result.should.be.equal('Bye World'))
                .end(done)
        })

        it('should return a download file when file exits with code 10', (done) => {
            request(app)
                .get('/download')
                .expect(200)
                .expect('Content-Disposition', /attachment/)
                .expect(res => res.text.should.not.be.empty())
                .end(done)
        })

        it('should create a route even when a file doesn\'t have execute permissions', (done) => {
            request(app)
                .get('/no-exec')
                .expect(200)
                .expect(res => res.body.result.should.be.equal('I\'m not executable'))
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
})
