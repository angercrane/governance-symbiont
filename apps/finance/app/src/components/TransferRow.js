import React from 'react'
import styled from 'styled-components'
import { format } from 'date-fns'
import copy from 'copy-to-clipboard'
import {
  TableRow,
  TableCell,
  ContextMenu,
  ContextMenuItem,
  IconShare,
  IconTokens,
  theme,
} from '@aragon/ui'
import { formatTokenAmount } from '../lib/utils'
import ConfirmMessage from './ConfirmMessage'

class TransferRow extends React.Component {
  state = {
    showCopyTransferMessage: false,
  }
  handleCopyTransferUrl = () => {
    copy(
      'https://app.aragon.one/#/finance/finance?params=' +
        encodeURIComponent(
          JSON.stringify({
            transaction: this.props.transaction,
          })
        )
    )
    this.setState({
      showCopyTransferMessage: true,
    })
  }
  handleViewApproval = () => {}
  handleConfirmMessageDone = () => {
    this.setState({
      showCopyTransferMessage: false,
    })
  }
  render() {
    const { showCopyTransferMessage } = this.state
    const {
      date,
      reference,
      amount,
      token,
      approvedBy,
      transaction,
    } = this.props
    return (
      <TableRow key={transaction}>
        <NoWrapCell>
          <time dateTime={format(date)} title={format(date)}>
            {format(date, 'DD/MM/YY')}
          </time>
        </NoWrapCell>
        <NoWrapCell>
          <TextOverflow>
            <a
              target="_blank"
              href={`https://etherscan.io/address/${approvedBy}`}
            >
              {approvedBy}
            </a>
          </TextOverflow>
        </NoWrapCell>
        <NoWrapCell>{reference}</NoWrapCell>
        <NoWrapCell align="right">
          <Amount positive={amount > 0}>
            {formatTokenAmount(amount, true)} {token}
          </Amount>
        </NoWrapCell>
        <NoWrapCell>
          <ActionsWrapper>
            <ContextMenu>
              <ContextMenuItem onClick={this.handleCopyTransferUrl}>
                <IconShare />
                Copy Transfer URL
              </ContextMenuItem>
              <ContextMenuItem onClick={this.handleViewApproval}>
                <IconTokens />
                View Transaction
              </ContextMenuItem>
            </ContextMenu>
            {showCopyTransferMessage && (
              <ConfirmMessageWrapper>
                <ConfirmMessage onDone={this.handleConfirmMessageDone}>
                  Transaction URL copied to clipboard
                </ConfirmMessage>
              </ConfirmMessageWrapper>
            )}
          </ActionsWrapper>
        </NoWrapCell>
      </TableRow>
    )
  }
}

const NoWrapCell = styled(TableCell)`
  white-space: nowrap;
`

const TextOverflow = styled.div`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const Amount = styled.span`
  font-weight: 600;
  color: ${({ positive }) => (positive ? theme.positive : theme.negative)};
`

const ActionsWrapper = styled.div`
  position: relative;
`

const ConfirmMessageWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
`

export default TransferRow
