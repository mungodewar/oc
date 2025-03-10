'use strict';

const expect = require('chai').expect;
const injectr = require('injectr');
const sinon = require('sinon');

describe('registry : domain : components-cache', () => {
  const mockedCdn = {
    getJson: sinon.stub(),
    listSubDirectories: sinon.stub(),
    putFileContent: sinon.stub(),
    maxConcurrentRequests: 10
  };

  const baseOptions = {
    pollingInterval: 5,
    storage: {
      options: {
        componentsDir: 'component'
      }
    }
  };

  const baseResponse = () => ({
    lastEdit: 12345678,
    components: { 'hello-world': ['1.0.0', '1.0.2'] }
  });

  let setTimeoutStub;
  let clearTimeoutStub;
  let componentsCache;
  let eventsHandlerStub;

  const getTimestamp = () => 12345678;

  const initialise = function () {
    clearTimeoutStub = sinon.stub();
    setTimeoutStub = sinon.stub();
    eventsHandlerStub = { fire: sinon.stub() };
    const ComponentsCache = injectr(
      '../../dist/registry/domain/components-cache/index.js',
      {
        'oc-get-unix-utc-timestamp': getTimestamp,
        '../events-handler': eventsHandlerStub,
        './components-list': injectr(
          '../../dist/registry/domain/components-cache/components-list.js',
          {
            'oc-get-unix-utc-timestamp': getTimestamp
          }
        ).default
      },
      {
        setTimeout: setTimeoutStub,
        clearTimeout: clearTimeoutStub
      }
    ).default;

    componentsCache = ComponentsCache(baseOptions, mockedCdn);
  };

  describe('when library does not contain components.json', () => {
    describe('when initialising the cache', () => {
      before(done => {
        mockedCdn.getJson = sinon.stub();
        mockedCdn.getJson.rejects('not_found');
        mockedCdn.listSubDirectories = sinon.stub();
        mockedCdn.listSubDirectories.onCall(0).resolves(['hello-world']);
        mockedCdn.listSubDirectories.onCall(1).resolves(['1.0.0', '1.0.2']);
        mockedCdn.putFileContent = sinon.stub();
        mockedCdn.putFileContent.resolves('ok');
        initialise();
        componentsCache.load().finally(done);
      });

      it('should try fetching the components.json', () => {
        expect(mockedCdn.getJson.calledOnce).to.be.true;
        expect(mockedCdn.getJson.args[0][0]).to.be.equal(
          'component/components.json'
        );
      });

      it('should scan for directories to fetch components and versions', () => {
        expect(mockedCdn.listSubDirectories.calledTwice).to.be.true;
      });

      it("should then save the directories' data to components.json file in cdn", () => {
        expect(mockedCdn.putFileContent.called).to.be.true;
        expect(mockedCdn.putFileContent.args[0][2]).to.be.true;
        expect(JSON.parse(mockedCdn.putFileContent.args[0][0])).to.eql({
          lastEdit: 12345678,
          components: {
            'hello-world': ['1.0.0', '1.0.2']
          }
        });
      });

      it('should start the refresh loop', () => {
        expect(setTimeoutStub.called).to.be.true;
        expect(setTimeoutStub.args[0][1]).to.equal(5000);
      });
    });
  });

  describe('when library contains outdated components.json', () => {
    describe('when initialising the cache', () => {
      before(done => {
        mockedCdn.getJson = sinon.stub();
        mockedCdn.getJson.resolves(baseResponse());
        mockedCdn.listSubDirectories = sinon.stub();
        mockedCdn.listSubDirectories.onCall(0).resolves(['hello-world']);
        mockedCdn.listSubDirectories
          .onCall(1)
          .resolves(['1.0.0', '1.0.2', '2.0.0']);
        mockedCdn.putFileContent = sinon.stub();
        mockedCdn.putFileContent.resolves('ok');
        initialise();
        componentsCache.load().finally(done);
      });

      it('should fetch the components.json', () => {
        expect(mockedCdn.getJson.calledOnce).to.be.true;
        expect(mockedCdn.getJson.args[0][0]).to.be.equal(
          'component/components.json'
        );
      });

      it('should scan for directories to fetch components and versions', () => {
        expect(mockedCdn.listSubDirectories.calledTwice).to.be.true;
      });

      it("should then save the directories' data to components.json file in cdn", () => {
        expect(mockedCdn.putFileContent.called).to.be.true;
        expect(mockedCdn.putFileContent.args[0][2]).to.be.true;
        expect(JSON.parse(mockedCdn.putFileContent.args[0][0])).to.eql({
          lastEdit: 12345678,
          components: {
            'hello-world': ['1.0.0', '1.0.2', '2.0.0']
          }
        });
      });

      it('should start the refresh loop', () => {
        expect(setTimeoutStub.called).to.be.true;
        expect(setTimeoutStub.args[0][1]).to.equal(5000);
      });
    });
  });

  describe('when library contains updated components.json', () => {
    describe('when initialising the cache', () => {
      before(done => {
        mockedCdn.getJson = sinon.stub();
        mockedCdn.getJson.resolves(baseResponse());
        mockedCdn.listSubDirectories = sinon.stub();
        mockedCdn.listSubDirectories.onCall(0).resolves(['hello-world']);
        mockedCdn.listSubDirectories.onCall(1).resolves(['1.0.0', '1.0.2']);
        mockedCdn.putFileContent = sinon.stub();
        initialise();
        componentsCache.load().finally(done);
      });

      it('should fetch the components.json', () => {
        expect(mockedCdn.getJson.calledOnce).to.be.true;
        expect(mockedCdn.getJson.args[0][0]).to.be.equal(
          'component/components.json'
        );
      });

      it('should scan for directories to fetch components and versions', () => {
        expect(mockedCdn.listSubDirectories.calledTwice).to.be.true;
      });

      it('should not modify components.json', () => {
        expect(mockedCdn.putFileContent.called).to.be.false;
      });

      it('should use it as a source of truth', () => {
        const res = componentsCache.get();
        expect(res).to.eql({
          lastEdit: 12345678,
          components: {
            'hello-world': ['1.0.0', '1.0.2']
          }
        });
      });

      it('should start the refresh loop', () => {
        expect(setTimeoutStub.called).to.be.true;
        expect(setTimeoutStub.args[0][1]).to.equal(5000);
      });
    });

    describe('when refreshing the cache', () => {
      const baseResponseUpdated = baseResponse();
      baseResponseUpdated.components['hello-world'].push('2.0.0');
      baseResponseUpdated.components['new-component'] = ['1.0.0'];
      baseResponseUpdated.lastEdit++;

      describe('when refresh errors', () => {
        before(done => {
          mockedCdn.getJson = sinon.stub();
          mockedCdn.getJson.resolves(baseResponse());
          mockedCdn.putFileContent = sinon.stub();
          mockedCdn.putFileContent.resolves('ok');
          mockedCdn.listSubDirectories = sinon.stub();
          mockedCdn.listSubDirectories.onCall(0).resolves(['hello-world']);
          mockedCdn.listSubDirectories.onCall(1).resolves(['1.0.0', '1.0.2']);
          mockedCdn.listSubDirectories
            .onCall(2)
            .resolves(['hello-world', 'new-component']);
          mockedCdn.listSubDirectories
            .onCall(3)
            .rejects(new Error('an error!'));
          mockedCdn.listSubDirectories.onCall(4).resolves(['1.0.0']);

          initialise();
          componentsCache
            .load()
            .then(() => componentsCache.refresh().finally(done));
        });

        it('should generate an error event', () => {
          expect(eventsHandlerStub.fire.called).to.be.true;
          expect(eventsHandlerStub.fire.args[0][0]).to.equal('error');
          expect(eventsHandlerStub.fire.args[0][1].code).to.equal(
            'components_cache_refresh'
          );
          expect(eventsHandlerStub.fire.args[0][1].message).to.contain(
            'an error!'
          );
        });
      });

      describe('when refresh does not generate errors', () => {
        before(done => {
          mockedCdn.getJson = sinon.stub();
          mockedCdn.getJson.resolves(baseResponse());
          mockedCdn.putFileContent = sinon.stub();
          mockedCdn.putFileContent.resolves('ok');
          mockedCdn.listSubDirectories = sinon.stub();
          mockedCdn.listSubDirectories.onCall(0).resolves(['hello-world']);
          mockedCdn.listSubDirectories.onCall(1).resolves(['1.0.0', '1.0.2']);
          mockedCdn.listSubDirectories
            .onCall(2)
            .resolves(['hello-world', 'new-component']);
          mockedCdn.listSubDirectories
            .onCall(3)
            .resolves(['1.0.0', '1.0.2', '2.0.0']);
          mockedCdn.listSubDirectories.onCall(4).resolves(['1.0.0']);

          initialise();
          componentsCache
            .load()
            .then(() => componentsCache.refresh().finally(done));
        });

        it('should have started, stopped and restarted the refresh loop', () => {
          expect(setTimeoutStub.calledTwice).to.be.true;
          expect(clearTimeoutStub.calledOnce).to.be.true;
        });

        it('should do list requests to cdn', () => {
          expect(mockedCdn.listSubDirectories.args.length).to.equal(5);
        });

        it('should do write request to cdn', () => {
          expect(mockedCdn.putFileContent.calledOnce).to.be.true;
        });

        it('should refresh the values', () => {
          const data = componentsCache.get();
          expect(data.lastEdit).to.equal(12345678);
          expect(data.components['new-component']).to.eql(['1.0.0']);
          expect(data.components['hello-world'].length).to.equal(3);
        });
      });
    });
  });
});
