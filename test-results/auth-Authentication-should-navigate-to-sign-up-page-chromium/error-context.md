# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - heading "Sign In" [level=1] [ref=e5]
    - paragraph [ref=e6]: FullStack Method™ App
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic:
          - text: Email
          - generic: "*"
        - generic [ref=e9]:
          - textbox "Email" [ref=e10]
          - group:
            - generic: Email *
      - generic [ref=e11]:
        - generic:
          - text: Password
          - generic: "*"
        - generic [ref=e12]:
          - textbox "Password" [ref=e13]
          - group:
            - generic: Password *
      - button "Sign In" [ref=e14] [cursor=pointer]: Sign In
      - paragraph [ref=e15]:
        - link "Forgot password?" [ref=e16] [cursor=pointer]:
          - /url: /auth/forgot-password
  - alert [ref=e17]
```