const PAYMENT_TYPES = require('../helpers/payment_types')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { getEvents, getEventArgument } = require('../helpers/events')
const { bn, maxUint64, annualSalaryPerSecond } = require('../helpers/numbers')(web3)
const { deployErc20TokenAndDeposit, deployContracts, createPayrollAndPriceFeed } = require('../helpers/deploy.js')(artifacts, web3)

contract('Payroll employees termination', ([owner, employee, anyone]) => {
  let dao, payroll, payrollBase, finance, vault, priceFeed, denominationToken

  const NOW = 1553703809 // random fixed timestamp in seconds
  const ONE_MONTH = 60 * 60 * 24 * 31
  const TWO_MONTHS = ONE_MONTH * 2
  const RATE_EXPIRATION_TIME = TWO_MONTHS

  const TOKEN_DECIMALS = 18

  const currentTimestamp = async () => payroll.getTimestampPublic()

  const increaseTime = async seconds => {
    await payroll.mockIncreaseTime(seconds)
    await priceFeed.mockIncreaseTime(seconds)
  }

  before('deploy base apps and tokens', async () => {
    ({ dao, finance, vault, payrollBase } = await deployContracts(owner))
    denominationToken = await deployErc20TokenAndDeposit(owner, finance, 'Denomination Token', TOKEN_DECIMALS)
  })

  beforeEach('create payroll and price feed instance', async () => {
    ({ payroll, priceFeed } = await createPayrollAndPriceFeed(dao, payrollBase, owner, NOW))
  })

  describe('terminateEmployee', () => {
    context('when it has already been initialized', function () {
      beforeEach('initialize payroll app', async () => {
        await payroll.initialize(finance.address, denominationToken.address, priceFeed.address, RATE_EXPIRATION_TIME, { from: owner })
      })

      context('when the given employee id exists', () => {
        let employeeId
        const salary = annualSalaryPerSecond(100000, TOKEN_DECIMALS)

        beforeEach('add employee', async () => {
          const receipt = await payroll.addEmployee(employee, salary, 'Boss', await payroll.getTimestampPublic(), { from: owner })
          employeeId = getEventArgument(receipt, 'AddEmployee', 'employeeId').toString()
        })

        context('when the sender has permissions to terminate employees', () => {
          const from = owner

          context('when the employee was not terminated', () => {
            let endDate

            beforeEach('allowed denomination token', async () => {
              await payroll.addAllowedToken(denominationToken.address, { from: owner })
            })

            context('when the given end date is in the future ', () => {
              beforeEach('set future end date', async () => {
                endDate = (await currentTimestamp()).plus(ONE_MONTH)
              })

              it('sets the end date of the employee', async () => {
                await payroll.terminateEmployee(employeeId, endDate, { from })

                const date = (await payroll.getEmployee(employeeId))[6]
                assert.equal(date.toString(), endDate.toString(), 'employee end date does not match')
              })

              it('emits an event', async () => {
                const receipt = await payroll.terminateEmployee(employeeId, endDate, { from })

                const events = getEvents(receipt, 'TerminateEmployee')
                assert.equal(events.length, 1, 'number of TerminateEmployee events does not match')

                const event  = events[0].args
                assert.equal(event.employeeId.toString(), employeeId, 'employee id does not match')
                assert.equal(event.accountAddress, employee, 'employee address does not match')
                assert.equal(event.endDate.toString(), endDate.toString(), 'employee end date does not match')
              })

              it('does not reset the owed salary nor the reimbursements of the employee', async () => {
                const previousBalance = await denominationToken.balanceOf(employee)
                await payroll.determineAllocation([denominationToken.address], [100], { from: employee })

                // Accrue some salary and extras
                await increaseTime(ONE_MONTH)
                const owedSalary = salary.times(ONE_MONTH)
                const reimbursement = 1000
                await payroll.addReimbursement(employeeId, reimbursement, { from: owner })

                // Terminate employee and travel some time in the future
                await payroll.terminateEmployee(employeeId, endDate, { from })
                await increaseTime(ONE_MONTH)

                // Request owed money
                await payroll.payday(PAYMENT_TYPES.PAYROLL, 0, { from: employee })
                await payroll.payday(PAYMENT_TYPES.REIMBURSEMENT, 0, { from: employee })
                await assertRevert(payroll.getEmployee(employeeId), 'PAYROLL_EMPLOYEE_DOESNT_EXIST')

                const currentBalance = await denominationToken.balanceOf(employee)
                const expectedCurrentBalance = previousBalance.plus(owedSalary).plus(reimbursement)
                assert.equal(currentBalance.toString(), expectedCurrentBalance.toString(), 'current balance does not match')
              })

              it('can re-add a removed employee', async () => {
                await payroll.determineAllocation([denominationToken.address], [100], { from: employee })
                await increaseTime(ONE_MONTH)

                // Terminate employee and travel some time in the future
                await payroll.terminateEmployee(employeeId, endDate, { from })
                await increaseTime(ONE_MONTH)

                // Request owed money
                await payroll.payday(PAYMENT_TYPES.PAYROLL, 0, { from: employee })
                await assertRevert(payroll.getEmployee(employeeId), 'PAYROLL_EMPLOYEE_DOESNT_EXIST')

                // Add employee back
                const receipt = await payroll.addEmployee(employee, salary, 'Boss', await payroll.getTimestampPublic())
                const newEmployeeId = getEventArgument(receipt, 'AddEmployee', 'employeeId')

                const [address, employeeSalary, bonus, reimbursements, accruedSalary, lastPayroll, date] = await payroll.getEmployee(newEmployeeId)
                assert.equal(address, employee, 'employee account does not match')
                assert.equal(employeeSalary.toString(), salary.toString(), 'employee salary does not match')
                assert.equal(lastPayroll.toString(), (await currentTimestamp()).toString(), 'employee last payroll date does not match')
                assert.equal(bonus.toString(), 0, 'employee bonus does not match')
                assert.equal(reimbursements.toString(), 0, 'employee reimbursements does not match')
                assert.equal(accruedSalary.toString(), 0, 'employee accrued salary does not match')
                assert.equal(date.toString(), maxUint64(), 'employee end date does not match')
              })
            })

            context('when the given end date is in the past', () => {
              beforeEach('set future end date', async () => {
                endDate = await currentTimestamp()
                await increaseTime(ONE_MONTH + 1)
              })

              it('reverts', async () => {
                await assertRevert(payroll.terminateEmployee(employeeId, endDate, { from }), 'PAYROLL_PAST_TERMINATION_DATE')
              })
            })
          })

          context('when the employee end date was already set', () => {
            beforeEach('terminate employee', async () => {
              await payroll.terminateEmployee(employeeId, (await currentTimestamp()).plus(ONE_MONTH), { from })
            })

            context('when the previous end date was not reached yet', () => {
              it('changes the employee end date', async () => {
                const newEndDate = bn(await currentTimestamp()).plus(ONE_MONTH * 2)
                await payroll.terminateEmployee(employeeId, newEndDate, { from })

                const endDate = (await payroll.getEmployee(employeeId))[6]
                assert.equal(endDate.toString(), newEndDate.toString(), 'employee end date does not match')
              })
            })

            context('when the previous end date was reached', () => {
              beforeEach('travel in the future', async () => {
                await increaseTime(ONE_MONTH + 1)
              })

              it('reverts', async () => {
                await assertRevert(payroll.terminateEmployee(employeeId, await currentTimestamp(), { from }), 'PAYROLL_NON_ACTIVE_EMPLOYEE')
              })
            })
          })
        })

        context('when the sender does not have permissions to terminate employees', () => {
          const from = anyone

          it('reverts', async () => {
            await assertRevert(payroll.terminateEmployee(employeeId, await currentTimestamp(), { from }), 'APP_AUTH_FAILED')
          })
        })
      })

      context('when the given employee id does not exist', () => {
        const employeeId = 0

        it('reverts', async () => {
          await assertRevert(payroll.terminateEmployee(employeeId, await currentTimestamp(), { from: owner }), 'PAYROLL_NON_ACTIVE_EMPLOYEE')
        })
      })
    })

    context('when it has not been initialized yet', function () {
      const employeeId = 0
      const endDate = NOW + ONE_MONTH

      it('reverts', async () => {
        await assertRevert(payroll.terminateEmployee(employeeId, endDate, { from: owner }), 'APP_AUTH_FAILED')
      })
    })
  })
})
