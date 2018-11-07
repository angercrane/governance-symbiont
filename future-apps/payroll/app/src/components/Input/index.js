import styled from 'styled-components'
import { Text } from '@aragon/ui'

import Input from './BaseInput'
import DateInput from './DateInput'
import EntitySelect from './EntitySelect'

// Text
Input.Text = styled(Input).attrs({
  type: 'text'
})``

// Numeric
Input.Number = styled(Input).attrs({
  type: 'number'
})``

Input.Currency = styled(Input.Number).attrs({
  min: 0
})``

// Date
Input.Date = DateInput

// Entity
Input.Entity = EntitySelect

// Static
Input.Static = styled(Text).attrs({
  weight: 'bold'
})`
  line-height: 33px;
  white-space: pre;
`

export default Input
