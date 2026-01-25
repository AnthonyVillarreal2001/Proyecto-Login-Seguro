const blacklist = require('../blacklist');

describe('Blacklist - Pruebas de Set', () => {
    beforeEach(() => {
        blacklist.clear();
    });

    test('add: agrega token', () => {
        blacklist.add('token1');
        expect(blacklist.has('token1')).toBe(true);
    });

    test('has: false si no existe', () => {
        expect(blacklist.has('noexiste')).toBe(false);
    });

    test('clear: limpia todo', () => {
        blacklist.add('token1');
        blacklist.clear();
        expect(blacklist.has('token1')).toBe(false);
    });
});