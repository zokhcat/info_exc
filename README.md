# Usage
```sh
bun run dev extract <url> -f <format>
```

format flags:
- json(default)
- yaml
- table

fields extracted:
- url
- title
- logo_url
- svg_url
- fonts
- meta - description, keywords, og_title, og_description, og_image

run tests:
```
- bun run test:logos
```