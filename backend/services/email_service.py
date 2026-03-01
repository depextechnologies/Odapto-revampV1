"""
Email Service for Odapto
Handles transactional email delivery via Gmail SMTP
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime, timezone
import asyncio
from functools import partial

logger = logging.getLogger(__name__)

# Odapto brand colors
BRAND_ORANGE = "#E67E4C"
BRAND_TEAL = "#3A8B84"
BRAND_DARK = "#1a1a1a"

def get_smtp_config():
    """Get SMTP configuration from environment at runtime"""
    return {
        'host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'port': int(os.environ.get('SMTP_PORT', 587)),
        'username': os.environ.get('SMTP_USERNAME', ''),
        'password': os.environ.get('SMTP_PASSWORD', ''),
        'from_name': os.environ.get('SMTP_FROM_NAME', 'Odapto')
    }

def get_email_template(content: str, title: str = "Odapto") -> str:
    """Generate branded HTML email template"""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 40px; background: linear-gradient(135deg, {BRAND_ORANGE} 0%, {BRAND_TEAL} 100%); border-radius: 12px 12px 0 0;">
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Odapto</h1>
                                        <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Work Management Made Simple</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0; color: #6c757d; font-size: 12px; text-align: center;">
                                This email was sent by Odapto. If you didn't expect this email, you can safely ignore it.
                            </p>
                            <p style="margin: 10px 0 0; color: #6c757d; font-size: 12px; text-align: center;">
                                &copy; {datetime.now().year} Odapto. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def get_workspace_invitation_content(
    inviter_name: str,
    workspace_name: str,
    role: str,
    invitation_link: str
) -> str:
    """Generate workspace invitation email content"""
    return f"""
<h2 style="margin: 0 0 20px; color: {BRAND_DARK}; font-size: 24px; font-weight: 600;">
    You've been invited!
</h2>
<p style="margin: 0 0 20px; color: #495057; font-size: 16px; line-height: 1.6;">
    <strong style="color: {BRAND_ORANGE};">{inviter_name}</strong> has invited you to join the workspace 
    <strong style="color: {BRAND_TEAL};">"{workspace_name}"</strong> on Odapto.
</p>
<p style="margin: 0 0 10px; color: #495057; font-size: 14px;">
    <strong>Your Role:</strong> <span style="background-color: {BRAND_TEAL}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{role.title()}</span>
</p>
<p style="margin: 0 0 30px; color: #6c757d; font-size: 14px; line-height: 1.5;">
    As a workspace member, you'll be able to collaborate on boards, manage tasks, and work together with your team.
</p>
<table role="presentation" style="width: 100%;">
    <tr>
        <td align="center">
            <a href="{invitation_link}" 
               style="display: inline-block; padding: 14px 40px; background-color: {BRAND_ORANGE}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(230, 126, 76, 0.3);">
                Accept Invitation
            </a>
        </td>
    </tr>
</table>
<p style="margin: 30px 0 0; color: #6c757d; font-size: 13px; text-align: center;">
    This invitation will expire in <strong>7 days</strong>. Click the button above to join!
</p>
<p style="margin: 15px 0 0; color: #adb5bd; font-size: 12px; text-align: center; word-break: break-all;">
    Or copy this link: {invitation_link}
</p>
"""


def get_card_invitation_content(
    inviter_name: str,
    card_title: str,
    board_name: str,
    invitation_link: str
) -> str:
    """Generate card assignment invitation email content"""
    return f"""
<h2 style="margin: 0 0 20px; color: {BRAND_DARK}; font-size: 24px; font-weight: 600;">
    You've been assigned to a task!
</h2>
<p style="margin: 0 0 20px; color: #495057; font-size: 16px; line-height: 1.6;">
    <strong style="color: {BRAND_ORANGE};">{inviter_name}</strong> has assigned you to a card on Odapto.
</p>
<div style="background-color: #f8f9fa; border-left: 4px solid {BRAND_TEAL}; padding: 15px 20px; margin: 0 0 20px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 5px; color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Card</p>
    <p style="margin: 0; color: {BRAND_DARK}; font-size: 18px; font-weight: 600;">{card_title}</p>
    <p style="margin: 10px 0 0; color: #6c757d; font-size: 13px;">
        on board <strong style="color: {BRAND_TEAL};">"{board_name}"</strong>
    </p>
</div>
<p style="margin: 0 0 30px; color: #6c757d; font-size: 14px; line-height: 1.5;">
    Click the button below to view the card details and start collaborating.
</p>
<table role="presentation" style="width: 100%;">
    <tr>
        <td align="center">
            <a href="{invitation_link}" 
               style="display: inline-block; padding: 14px 40px; background-color: {BRAND_ORANGE}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(230, 126, 76, 0.3);">
                View Card
            </a>
        </td>
    </tr>
</table>
<p style="margin: 30px 0 0; color: #6c757d; font-size: 13px; text-align: center;">
    This invitation will expire in <strong>7 days</strong>.
</p>
<p style="margin: 15px 0 0; color: #adb5bd; font-size: 12px; text-align: center; word-break: break-all;">
    Or copy this link: {invitation_link}
</p>
"""


def get_board_invitation_content(
    inviter_name: str,
    board_name: str,
    role: str,
    invitation_link: str
) -> str:
    """Generate board invitation email content"""
    return f"""
<h2 style="margin: 0 0 20px; color: {BRAND_DARK}; font-size: 24px; font-weight: 600;">
    You've been invited to a board!
</h2>
<p style="margin: 0 0 20px; color: #495057; font-size: 16px; line-height: 1.6;">
    <strong style="color: {BRAND_ORANGE};">{inviter_name}</strong> has invited you to collaborate on the board 
    <strong style="color: {BRAND_TEAL};">"{board_name}"</strong>.
</p>
<p style="margin: 0 0 10px; color: #495057; font-size: 14px;">
    <strong>Your Role:</strong> <span style="background-color: {BRAND_TEAL}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{role.title()}</span>
</p>
<p style="margin: 0 0 30px; color: #6c757d; font-size: 14px; line-height: 1.5;">
    As a board member, you'll be able to view and manage cards, add comments, and collaborate with your team.
</p>
<table role="presentation" style="width: 100%;">
    <tr>
        <td align="center">
            <a href="{invitation_link}" 
               style="display: inline-block; padding: 14px 40px; background-color: {BRAND_ORANGE}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(230, 126, 76, 0.3);">
                Accept Invitation
            </a>
        </td>
    </tr>
</table>
<p style="margin: 30px 0 0; color: #6c757d; font-size: 13px; text-align: center;">
    This invitation will expire in <strong>7 days</strong>. Click the button above to join!
</p>
<p style="margin: 15px 0 0; color: #adb5bd; font-size: 12px; text-align: center; word-break: break-all;">
    Or copy this link: {invitation_link}
</p>
"""


def _send_email_sync(
    to_email: str,
    subject: str,
    html_content: str,
    max_retries: int = 3
) -> dict:
    """Synchronous email sending with retries"""
    
    # Get SMTP config at runtime
    smtp_config = get_smtp_config()
    SMTP_HOST = smtp_config['host']
    SMTP_PORT = smtp_config['port']
    SMTP_USERNAME = smtp_config['username']
    SMTP_PASSWORD = smtp_config['password']
    SMTP_FROM_NAME = smtp_config['from_name']
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.error("SMTP credentials not configured")
        return {
            "success": False,
            "error": "SMTP credentials not configured",
            "to_email": to_email,
            "subject": subject
        }
    
    for attempt in range(max_retries):
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_USERNAME}>"
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Connect and send
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_USERNAME, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email} - Subject: {subject}")
            return {
                "success": True,
                "to_email": to_email,
                "subject": subject,
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return {
                "success": False,
                "error": "SMTP authentication failed",
                "to_email": to_email,
                "subject": subject
            }
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"Recipient refused: {to_email} - {e}")
            return {
                "success": False,
                "error": f"Recipient refused: {to_email}",
                "to_email": to_email,
                "subject": subject
            }
        except Exception as e:
            logger.warning(f"Email send attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt == max_retries - 1:
                logger.error(f"All email send attempts failed for {to_email}: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "to_email": to_email,
                    "subject": subject
                }
    
    return {
        "success": False,
        "error": "Max retries exceeded",
        "to_email": to_email,
        "subject": subject
    }


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    max_retries: int = 3
) -> dict:
    """Async wrapper for email sending"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(_send_email_sync, to_email, subject, html_content, max_retries)
    )
    return result


async def send_workspace_invitation_email(
    to_email: str,
    inviter_name: str,
    workspace_name: str,
    role: str,
    invitation_link: str
) -> dict:
    """Send workspace invitation email"""
    content = get_workspace_invitation_content(inviter_name, workspace_name, role, invitation_link)
    html = get_email_template(content, f"Workspace Invitation - {workspace_name}")
    return await send_email(
        to_email=to_email,
        subject=f"[Odapto] {inviter_name} invited you to {workspace_name}",
        html_content=html
    )


async def send_board_invitation_email(
    to_email: str,
    inviter_name: str,
    board_name: str,
    role: str,
    invitation_link: str
) -> dict:
    """Send board invitation email"""
    content = get_board_invitation_content(inviter_name, board_name, role, invitation_link)
    html = get_email_template(content, f"Board Invitation - {board_name}")
    return await send_email(
        to_email=to_email,
        subject=f"[Odapto] {inviter_name} invited you to collaborate on {board_name}",
        html_content=html
    )


async def send_card_invitation_email(
    to_email: str,
    inviter_name: str,
    card_title: str,
    board_name: str,
    invitation_link: str
) -> dict:
    """Send card assignment invitation email"""
    content = get_card_invitation_content(inviter_name, card_title, board_name, invitation_link)
    html = get_email_template(content, f"Task Assignment - {card_title}")
    return await send_email(
        to_email=to_email,
        subject=f"[Odapto] {inviter_name} assigned you to: {card_title}",
        html_content=html
    )
