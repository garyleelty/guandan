import { identify } from './src/core/combos'
import { mk } from './src/core/testutil'

const r = mk('BJ0', 'BJ1', 'SJ0', 'SJ1')
console.log('rocket cards:', r.map((c) => c.id))
console.log('rocket identify:', identify(r))
console.log('pairs5 identify:', identify(mk('10', '10', 'J', 'J', 'Q', 'Q', 'K', 'K', 'A', 'A')))
console.log('kjoker pair:', identify(mk('SJ0', 'BJ1')))
