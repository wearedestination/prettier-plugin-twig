import { expect } from 'chai';
import { getTwigSingleQuote, resetTwigSingleQuoteWarning } from 'src/utils';

describe('Module: utils', () => {
  describe('Unit: getTwigSingleQuote', () => {
    let warnCalls: string[];
    let originalWarn: typeof console.warn;

    beforeEach(() => {
      warnCalls = [];
      originalWarn = console.warn;
      console.warn = (message: string) => {
        warnCalls.push(message);
      };
      // Reset the warning state before each test
      resetTwigSingleQuoteWarning();
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it('should return twigSingleQuote when liquidSingleQuote is not set', () => {
      expect(getTwigSingleQuote({ twigSingleQuote: true })).to.equal(true);
      expect(getTwigSingleQuote({ twigSingleQuote: false })).to.equal(false);
      expect(warnCalls.length).to.equal(0);
    });

    it('should return twigSingleQuote when liquidSingleQuote is undefined', () => {
      expect(getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: undefined })).to.equal(
        true,
      );
      expect(getTwigSingleQuote({ twigSingleQuote: false, liquidSingleQuote: undefined })).to.equal(
        false,
      );
      expect(warnCalls.length).to.equal(0);
    });

    it('should return liquidSingleQuote when it is explicitly set', () => {
      expect(getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: false })).to.equal(
        false,
      );

      resetTwigSingleQuoteWarning();

      expect(getTwigSingleQuote({ twigSingleQuote: false, liquidSingleQuote: true })).to.equal(
        true,
      );
    });

    it('should show deprecation warning when liquidSingleQuote is explicitly set', () => {
      getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: false });

      expect(warnCalls.length).to.equal(1);
      expect(warnCalls[0]).to.include('liquidSingleQuote');
      expect(warnCalls[0]).to.include('deprecated');
      expect(warnCalls[0]).to.include('twigSingleQuote');
    });

    it('should only show deprecation warning once per session', () => {
      getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: false });
      getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: false });
      getTwigSingleQuote({ twigSingleQuote: false, liquidSingleQuote: true });

      expect(warnCalls.length).to.equal(1);
    });

    it('should prefer liquidSingleQuote over twigSingleQuote for backwards compatibility', () => {
      // When both are set, liquidSingleQuote should win
      expect(getTwigSingleQuote({ twigSingleQuote: true, liquidSingleQuote: false })).to.equal(
        false,
      );

      resetTwigSingleQuoteWarning();

      expect(getTwigSingleQuote({ twigSingleQuote: false, liquidSingleQuote: true })).to.equal(
        true,
      );
    });
  });
});
