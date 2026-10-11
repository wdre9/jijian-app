import { describe, expect, it } from 'vitest'
import {
  changeRate,
  intComma,
  money,
  moneyCny,
  moneyShort,
  percent,
  priceText,
  qty,
  round,
  toNum,
  yuan
} from '@/utils/format'

/**
 * A28 单元测试（一）：金额计算与格式化。
 * 覆盖 round 浮点规避、toNum 安全转换、money 千分位、priceText 去尾零、大额缩写等
 * 计件工资核心数值路径，防止精度回归。
 */
describe('金额计算与格式化', () => {
  it('round 四舍五入并规避浮点误差', () => {
    expect(round(0.1 + 0.2, 2)).toBe(0.3)
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(2.555, 2)).toBe(2.56)
    expect(round(3.14159, 2)).toBe(3.14)
    expect(round(3, 0)).toBe(3)
    expect(round(NaN, 2)).toBe(0)
    expect(round(Infinity, 2)).toBe(0)
    expect(round(-Infinity, 2)).toBe(0)
  })

  it('toNum 安全转换：合法数字与脏值兜底', () => {
    expect(toNum('12.5')).toBe(12.5)
    expect(toNum(12)).toBe(12)
    expect(toNum('0')).toBe(0)
    expect(toNum('abc')).toBe(0)
    expect(toNum(null)).toBe(0)
    expect(toNum(undefined)).toBe(0)
    expect(toNum('')).toBe(0)
    expect(toNum(NaN)).toBe(0)
  })

  it('money 千分位与两位小数', () => {
    expect(money(1234.5)).toBe('1,234.50')
    expect(money(0)).toBe('0.00')
    expect(money(1000000)).toBe('1,000,000.00')
    expect(money(12.1)).toBe('12.10')
    expect(money(-1234.5)).toBe('-1,234.50')
  })

  it('yuan / moneyCny 带 ¥ 前缀', () => {
    expect(yuan(12.3)).toBe('¥12.30')
    expect(moneyCny(12.3)).toBe('¥12.30')
    expect(yuan(0)).toBe('¥0.00')
  })

  it('moneyShort 大额缩写', () => {
    expect(moneyShort(12800)).toBe('1.28万')
    expect(moneyShort(100000000)).toBe('1亿')
    expect(moneyShort(999)).toBe('999.00')
    expect(moneyShort(0)).toBe('0.00')
  })

  it('priceText 单价去尾零', () => {
    expect(priceText(0.5)).toBe('0.5')
    expect(priceText(2)).toBe('2')
    expect(priceText(2.3456)).toBe('2.3456')
    expect(priceText(0)).toBe('0')
    expect(priceText(NaN)).toBe('0')
  })

  it('qty 数量格式：整数不带小数点', () => {
    expect(qty(5)).toBe('5')
    expect(qty(5.5)).toBe('5.5')
    expect(qty(5.555)).toBe('5.56')
    expect(qty(0)).toBe('0')
  })

  it('intComma 千分位整数', () => {
    expect(intComma(1234567)).toBe('1,234,567')
    expect(intComma(123)).toBe('123')
  })

  it('percent 百分比格式化', () => {
    expect(percent(0.1234)).toBe('12.3%')
    expect(percent(0.5)).toBe('50%')
    expect(percent(1)).toBe('100%')
  })

  it('changeRate 环比变化', () => {
    expect(changeRate(120, 100)).toBe(0.2)
    expect(changeRate(80, 100)).toBe(-0.2)
    expect(changeRate(0, 0)).toBe(0)
    expect(changeRate(10, 0)).toBe(1)
  })
})
