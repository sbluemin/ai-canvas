from playwright.sync_api import sync_playwright

def test_auth_buttons_rendered():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:3000...")
            page.goto("http://localhost:3000", timeout=30000)

            # Wait for command bar
            print("Waiting for .command-bar...")
            page.wait_for_selector(".command-bar", timeout=10000)

            # Take screenshot of the whole page first
            page.screenshot(path="page_screenshot.png")
            print("Page screenshot saved.")

            # Check for buttons
            gemini_btn = page.locator("button[title='Gemini 로그인']").first
            codex_btn = page.locator("button[title='Codex 로그인']").first
            claude_btn = page.locator("button[title='Claude 로그인']").first

            if gemini_btn.is_visible():
                print("Gemini button is visible.")
            else:
                print("Gemini button NOT visible.")

            if codex_btn.is_visible():
                print("Codex button is visible.")
            else:
                print("Codex button NOT visible.")

            if claude_btn.is_visible():
                print("Claude button is visible.")
            else:
                print("Claude button NOT visible.")

            # Take specific screenshot of command bar
            command_bar = page.locator(".command-bar")
            if command_bar.is_visible():
                command_bar.screenshot(path="command_bar.png")
                print("Command bar screenshot saved to command_bar.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screenshot.png")

if __name__ == "__main__":
    test_auth_buttons_rendered()
