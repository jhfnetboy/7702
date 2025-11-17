import { test, expect } from '@playwright/test'

test.describe('EIP-7702 Demo Application', () => {
  test.beforeEach(async ({ page }) => {
    // 加载首页
    await page.goto('/')
  })

  test.describe('首页加载', () => {
    test('应该加载应用首页', async ({ page }) => {
      // 检查标题
      await expect(page).toHaveTitle('EIP-7702 Demo')
    })

    test('应该显示主要标题', async ({ page }) => {
      const heading = page.locator('h1')
      await expect(heading).toContainText('EIP-7702 Demo Application')
    })

    test('应该显示副标题', async ({ page }) => {
      const subtitle = page.locator('.header-content p')
      await expect(subtitle).toContainText('Gas-sponsored transactions')
    })

    test('应该显示导航菜单', async ({ page }) => {
      const navButtons = page.locator('.nav-button')
      const count = await navButtons.count()
      expect(count).toBe(2)
    })

    test('应该显示页脚', async ({ page }) => {
      const footer = page.locator('.app-footer')
      await expect(footer).toContainText('EIP-7702 Demo')
    })
  })

  test.describe('导航功能', () => {
    test('默认应该选中 Demo 标签页', async ({ page }) => {
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await expect(demoButton).toHaveClass(/active/)
    })

    test('点击 Dashboard 按钮应该切换标签页', async ({ page }) => {
      const dashboardButton = page.locator('button:has-text("Dashboard")')
      await dashboardButton.click()

      // 检查 Dashboard 按钮是否处于活跃状态
      await expect(dashboardButton).toHaveClass(/active/)

      // 检查 Demo 按钮是否不活跃
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await expect(demoButton).not.toHaveClass(/active/)
    })

    test('点击 Demo 按钮应该切换回 Demo 标签页', async ({ page }) => {
      const dashboardButton = page.locator('button:has-text("Dashboard")')
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')

      // 先切换到 Dashboard
      await dashboardButton.click()
      await expect(dashboardButton).toHaveClass(/active/)

      // 再切换回 Demo
      await demoButton.click()
      await expect(demoButton).toHaveClass(/active/)
    })
  })

  test.describe('EIP-7702 Demo 标签页', () => {
    test('应该显示 Relay 账户地址', async ({ page }) => {
      // 确保在 Demo 标签页
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await demoButton.click()

      // 查找包含 VITE_RELAY 地址的元素
      const content = await page.locator('.demo-content').textContent()
      // 检查页面是否有内容（不是空白）
      expect(content).toBeTruthy()
      expect(content?.length).toBeGreaterThan(50)
    })

    test('应该显示表单输入字段', async ({ page }) => {
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await demoButton.click()

      // 查找输入字段
      const inputs = page.locator('input')
      const count = await inputs.count()
      expect(count).toBeGreaterThan(0)
    })

    test('应该显示操作按钮', async ({ page }) => {
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await demoButton.click()

      // 查找操作按钮
      const buttons = page.locator('button')
      const count = await buttons.count()
      // 至少有导航按钮 + 操作按钮
      expect(count).toBeGreaterThanOrEqual(3)
    })
  })

  test.describe('Dashboard 标签页', () => {
    test('应该显示 MetaMask 连接按钮或已连接状态', async ({ page }) => {
      const dashboardButton = page.locator('button:has-text("Dashboard")')
      await dashboardButton.click()

      const content = await page.locator('.dashboard-content').textContent()
      expect(content).toBeTruthy()
      expect(
        content?.includes('Connect') || content?.includes('MetaMask') || content?.includes('0x')
      ).toBeTruthy()
    })
  })

  test.describe('响应式设计', () => {
    test('在桌面视口上应该正确加载', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      const app = page.locator('.app')
      await expect(app).toBeVisible()
    })

    test('在平板视口上应该正确加载', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      const app = page.locator('.app')
      await expect(app).toBeVisible()
    })

    test('在手机视口上应该正确加载', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      const app = page.locator('.app')
      await expect(app).toBeVisible()
    })
  })

  test.describe('页面元素可见性', () => {
    test('header 应该始终可见', async ({ page }) => {
      const header = page.locator('.app-header')
      await expect(header).toBeVisible()
    })

    test('nav 应该始终可见', async ({ page }) => {
      const nav = page.locator('.app-nav')
      await expect(nav).toBeVisible()
    })

    test('main 内容区应该存在', async ({ page }) => {
      const main = page.locator('.app-main')
      await expect(main).toBeVisible()
    })

    test('footer 应该存在', async ({ page }) => {
      const footer = page.locator('.app-footer')
      await expect(footer).toBeVisible()
    })
  })

  test.describe('页脚链接', () => {
    test('应该显示 Viem 文档链接', async ({ page }) => {
      const viemLink = page.locator('a[href*="viem.sh"]')
      await expect(viemLink).toBeVisible()
      await expect(viemLink).toContainText('Viem')
    })

    test('应该显示 EIP-7702 规范链接', async ({ page }) => {
      const eipLink = page.locator('a[href*="eips.ethereum.org"]')
      await expect(eipLink).toBeVisible()
      await expect(eipLink).toContainText('EIP-7702')
    })

    test('应该显示 Sepolia Etherscan 链接', async ({ page }) => {
      const etherscanLink = page.locator('a[href*="sepolia.etherscan.io"]')
      await expect(etherscanLink).toBeVisible()
      await expect(etherscanLink).toContainText('Sepolia')
    })
  })

  test.describe('样式和布局', () => {
    test('应该应用正确的 CSS 类', async ({ page }) => {
      const app = page.locator('.app')
      await expect(app).toHaveClass('app')

      const header = page.locator('.app-header')
      await expect(header).toHaveClass('app-header')

      const nav = page.locator('.app-nav')
      await expect(nav).toHaveClass('app-nav')
    })

    test('活跃的导航按钮应该有 active 类', async ({ page }) => {
      const demoButton = page.locator('button:has-text("EIP-7702 Demo")')
      await expect(demoButton).toHaveClass(/active/)

      const dashboardButton = page.locator('button:has-text("Dashboard")')
      await dashboardButton.click()

      await expect(dashboardButton).toHaveClass(/active/)
      await expect(demoButton).not.toHaveClass(/active/)
    })
  })
})
