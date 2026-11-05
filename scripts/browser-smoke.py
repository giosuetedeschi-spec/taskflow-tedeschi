"""Headless browser smoke check. Requires the Python playwright package and Chromium.

Read-only by default. --full creates disposable example.test accounts and a
private test project on the target server; use it only on a test deployment.
"""

import argparse
import re
import secrets
from datetime import datetime, timezone

from playwright.sync_api import expect, sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://taskflow.gabrielateleaga.com")
    parser.add_argument("--full", action="store_true", help="Create test accounts, project, task and chat messages")
    parser.add_argument("--screenshot", help="Save a screenshot of the login page")
    parser.add_argument("--browser-executable", help="Use an installed Chromium-family browser instead of Playwright's bundled one")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    errors: list[str] = []
    chat_network: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=args.browser_executable)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: chat_network.append(f"REQUEST {request.method} {request.url}") if "/messages" in request.url else None)
        page.on("response", lambda response: chat_network.append(f"RESPONSE {response.status} {response.url}") if "/messages" in response.url else None)
        response = page.goto(base, wait_until="networkidle", timeout=20_000)
        assert response is not None and response.status == 200, f"Home HTTP {response.status if response else 'no response'}"
        expect(page.get_by_role("heading", name="Accedi a TaskFlow")).to_be_visible()
        if args.screenshot:
            page.screenshot(path=args.screenshot, full_page=True)
        print("PASS: home and login UI")

        health = context.request.get(f"{base}/api/v1/health")
        assert health.ok and health.json() == {"status": "ok"}, f"Health HTTP {health.status}"
        print("PASS: API health")

        if args.full:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            owner_email = f"browser.owner.{stamp}@example.test"
            member_email = f"browser.member.{stamp}@example.test"
            password = "TaskflowSmoke-" + secrets.token_urlsafe(18)
            project_name = f"Verifica browser {stamp}"
            task_name = f"Task verifica {stamp}"
            message = f"Messaggio verifica {stamp}"

            page.get_by_role("button", name="Crea un account").click()
            page.get_by_label("Nome visualizzato").fill("Browser Owner Demo")
            page.get_by_label("Email").fill(owner_email)
            page.get_by_label("Password").fill(password)
            page.get_by_role("button", name="Registrati").click()
            expect(page.get_by_role("heading", name="Progetti", exact=True)).to_be_visible()
            print("PASS: registration and login")

            page.get_by_role("button", name=re.compile("Nuovo progetto")).click()
            page.get_by_label("Nome", exact=True).fill(project_name)
            page.get_by_label("Descrizione").fill("Progetto privato per verifica browser")
            page.get_by_role("button", name="Salva progetto").click()
            expect(page.locator(".board-column")).to_have_count(3)
            expect(page.get_by_role("heading", name=project_name)).to_be_visible()
            project_path = page.url
            print("PASS: private project and three-column board")

            page.get_by_role("button", name=re.compile("Nuovo task")).click()
            page.get_by_label("Titolo").fill(task_name)
            page.get_by_role("button", name="Salva task").click()
            todo = page.locator(".board-column").nth(0)
            doing = page.locator(".board-column").nth(1)
            expect(todo.locator(".task-card", has_text=task_name)).to_have_count(1)
            todo.locator(".task-card", has_text=task_name).locator(".move-button").click()
            expect(doing.locator(".task-card", has_text=task_name)).to_have_count(1)
            expect(todo.locator(".task-card", has_text=task_name)).to_have_count(0)
            print("PASS: task create and move, without duplicates")

            page.get_by_role("button", name=re.compile("Chat")).click()
            composer = page.get_by_placeholder(re.compile("Scrivi un messaggio"))
            composer.fill(message)
            composer.press("Enter")
            try:
                expect(page.locator(".chat-message", has_text=message)).to_have_count(1)
            except AssertionError:
                print(f"CHAT DEBUG URL: {page.url}")
                print(f"CHAT DEBUG BODY: {page.locator('body').inner_text()[:700]}")
                print(f"CHAT DEBUG ERRORS: {errors}")
                print(f"CHAT DEBUG NETWORK: {chat_network}")
                raise
            expect(composer).to_have_value("")
            assert page.url == project_path, "Chat submission navigated away from the project"
            assert not page.get_by_role("heading", name="Accedi a TaskFlow").is_visible(), "Chat submission logged out"
            composer.fill("Prima riga")
            composer.press("Shift+Enter")
            expect(composer).to_have_value("Prima riga\n")
            composer.fill("Prima riga\nSeconda riga")
            composer.press("Enter")
            expect(page.locator(".chat-message", has_text="Prima riga")).to_have_count(1)
            print("PASS: chat Enter, Shift+Enter and stable session")

            page.get_by_role("button", name="Chiudi chat").click()
            page.reload(wait_until="networkidle")
            expect(page.get_by_role("heading", name=project_name)).to_be_visible()
            page.get_by_role("button", name=re.compile("Chat")).click()
            expect(page.locator(".chat-message", has_text=message)).to_have_count(1)
            print("PASS: refresh session and persisted chat")

            page.get_by_role("button", name="Chiudi chat").click()
            page.get_by_role("button", name=re.compile("Membri")).click()
            page.get_by_role("button", name=re.compile("Crea link di invito")).click()
            invite_link = page.get_by_role("textbox", name="Link invito").input_value()
            assert invite_link.startswith(f"{base}/invite/"), "Invite link has the wrong origin"
            expect(page.locator(".invite-link [role=status]")).to_contain_text("Link creato")
            print("PASS: invitation URL visible on the correct origin")

            member_context = browser.new_context(viewport={"width": 1440, "height": 900})
            member_page = member_context.new_page()
            member_page.on("pageerror", lambda error: errors.append(str(error)))
            member_page.goto(invite_link, wait_until="networkidle", timeout=20_000)
            member_page.get_by_role("button", name="Crea un account").click()
            member_page.get_by_label("Nome visualizzato").fill("Browser Member Demo")
            member_page.get_by_label("Email").fill(member_email)
            member_page.get_by_label("Password").fill(password)
            member_page.get_by_role("button", name="Registrati").click()
            expect(member_page.get_by_role("heading", name=project_name)).to_be_visible(timeout=10_000)
            expect(member_page.locator(".task-card", has_text=task_name)).to_have_count(1)
            print("PASS: second account accepts invite and sees board")
            member_context.close()

        assert not errors, f"Browser JavaScript errors: {errors}"
        print("PASS: no uncaught JavaScript error")
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
