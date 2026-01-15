import asyncio
import json
from dataclasses import asdict
from enum import Enum

import typer

from internal.lib import extract_data


class OutputFormat(str, Enum):
    json = "json"
    table = "table"
    yaml = "yaml"


app = typer.Typer(help="brand info extractor CLI")


@app.callback()
def callback():
    """brand info extractor CLI"""
    pass


def print_table(data: dict) -> None:
    """Print data as a formatted table."""
    max_key_len = max(len(k) for k in data.keys())
    for key, value in data.items():
        if isinstance(value, list):
            value = ", ".join(value) if value else "None"
        typer.echo(f"{key:<{max_key_len}}  │  {value}")


def print_yaml(data: dict) -> None:
    """Print data as YAML."""
    for key, value in data.items():
        if isinstance(value, list):
            typer.echo(f"{key}:")
            for item in value:
                typer.echo(f"  - {item}")
        else:
            typer.echo(f"{key}: {value}")


@app.command()
def extract(
    url: str = typer.Argument(..., help="The website URL to extract from"),
    format: OutputFormat = typer.Option(
        OutputFormat.json, "--format", "-f", help="Output format"
    ),
):
    """extract brand info from a website URL."""
    try:
        data = asyncio.run(extract_data(url))
    except Exception as e:
        typer.echo(f"Error extracting data: {e}", err=True)
        raise typer.Exit(code=1)

    result = asdict(data)

    match format:
        case OutputFormat.json:
            typer.echo(json.dumps(result, indent=2))
        case OutputFormat.table:
            print_table(result)
        case OutputFormat.yaml:
            print_yaml(result)


if __name__ == "__main__":
    app()