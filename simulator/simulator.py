#!/usr/bin/env python3
"""
RhizoSense External Simulator CLI — V2
Supports 5m x 5m spatial micro-zones (default: Zone B3) and agronomic scenarios.

Usage:
    python simulator.py --scenario normal
    python simulator.py --scenario drought
    python simulator.py --scenario pest
    python simulator.py --scenario heat
    python simulator.py --scenario flood
    python simulator.py --target-zone B3
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(PROJECT_ROOT) == "simulator":
    PROJECT_ROOT = os.path.dirname(PROJECT_ROOT)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import requests

from simulator.scenarios.normal import NormalScenario
from simulator.scenarios.drought import DroughtScenario
from simulator.scenarios.pest import PestScenario
from simulator.scenarios.heat import HeatScenario
from simulator.scenarios.flood import FloodScenario


SCENARIO_MAP = {
    "normal": NormalScenario,
    "drought": DroughtScenario,
    "pest": PestScenario,
    "heat": HeatScenario,
    "flood": FloodScenario,
}


def print_banner(scenario_name: str, desc: str, target_zone: str, interval: float, url: str):
    print("\n" + "=" * 68)
    print("           [RHIZOSENSE V2 AGRICULTURAL SIMULATOR ENGINE]")
    print("=" * 68)
    print(f"  Scenario     : {scenario_name.upper()}")
    print(f"  Target Zone  : {target_zone.upper()} (5m x 5m Micro-Zone)")
    print(f"  Interval     : {interval} sec/tick")
    print(f"  Backend URL  : {url}")
    print(f"  Description  : {desc}")
    print("=" * 68)
    print("  Press Ctrl+C at any time to stop the simulation.\n")


def run_simulator(
    scenario_name: str,
    target_zone: str = "B3",
    interval: float = 1.0,
    max_ticks: Optional[int] = None,
    backend_url: str = "http://127.0.0.1:8000",
    reset_first: bool = True,
    dry_run: bool = False,
):
    scenario_cls = SCENARIO_MAP.get(scenario_name.lower())
    if not scenario_cls:
        print(f"[ERROR] Unknown scenario '{scenario_name}'. Supported scenarios: {list(SCENARIO_MAP.keys())}")
        sys.exit(1)

    norm_zone = "B3" if target_zone.lower() in ["field-c", "c"] else target_zone.upper()
    scenario = scenario_cls(target_field=norm_zone)
    print_banner(scenario.get_name(), scenario.get_description(), norm_zone, interval, backend_url if not dry_run else "(dry-run mode)")

    # 1. Reset backend to baseline if requested
    if reset_first and not dry_run:
        try:
            res = requests.post(f"{backend_url}/api/simulator/reset", timeout=3.0)
            if res.status_code == 200:
                print(f"[BACKEND] Successfully reset farm & 25 zones to baseline state.")
        except Exception as e:
            print(f"[WARNING] Could not connect to backend at {backend_url} ({e}). Proceeding anyway...")

    # 2. Simulation Loop
    tick = 0
    try:
        while True:
            tick += 1
            if max_ticks and tick > max_ticks:
                print(f"\n[DONE] Reached maximum ticks ({max_ticks}). Simulation complete.")
                break

            telemetry = scenario.next_tick()
            telemetry["field_id"] = norm_zone
            sm = telemetry["soil_moisture"]
            temp = telemetry["temperature"]
            hum = telemetry["humidity"]
            rain = telemetry.get("rainfall_mm", 0.0)
            pest = telemetry.get("pest_level", 0.0)

            # Send telemetry to backend if not dry-run
            status_text = "DRY-RUN" if dry_run else "NORMAL"
            notif_text = ""
            if not dry_run:
                try:
                    res = requests.post(
                        f"{backend_url}/api/simulator/telemetry",
                        json=telemetry,
                        timeout=3.0,
                    )
                    if res.status_code == 200:
                        resp_data = res.json()
                        risk_level = resp_data.get("riskLevel", resp_data.get("fieldStatus", "UNKNOWN"))
                        status_text = risk_level.upper()
                        if resp_data.get("notificationCreated"):
                            notif_text = " [ALERT GENERATED]"
                    else:
                        status_text = f"HTTP {res.status_code}"
                except Exception as e:
                    status_text = f"BACKEND OFFLINE ({type(e).__name__})"

            # Print informative tick line
            status_badge = f"[{status_text}]"
            print(
                f"Tick {tick:02d} | Zone: {norm_zone} | Moisture: {sm:4.1f}% | "
                f"Temp: {temp:4.1f}C | Hum: {hum:4.1f}% | Rain: {rain:3.1f}mm | "
                f"Pest: {pest:3.0f}% | Status: {status_badge:<14}{notif_text}"
            )

            time.sleep(interval)

    except KeyboardInterrupt:
        print(f"\n[STOPPED] Simulation interrupted by user at tick {tick}. Exiting cleanly.")


def main():
    parser = argparse.ArgumentParser(description="RhizoSense V2 Telemetry Simulator")
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["normal", "drought", "pest", "heat", "flood"],
        default="drought",
        help="Scenario to run (normal, drought, pest, heat, flood)",
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to JSON file with scenario parameters",
    )
    parser.add_argument(
        "--target-zone",
        "--target-field",
        type=str,
        default="B3",
        help="Target zone/field identifier (default: B3)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=1.0,
        help="Telemetry interval in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=None,
        help="Total duration/ticks to run (default: runs indefinitely until Ctrl+C)",
    )
    parser.add_argument(
        "--backend-url",
        type=str,
        default="http://127.0.0.1:8000",
        help="FastAPI backend URL (default: http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Do not reset farm to baseline before starting scenario",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run simulation locally without sending requests to the backend",
    )

    args = parser.parse_args()

    scenario_name = args.scenario
    target_zone = args.target_zone
    interval = args.interval
    duration = args.duration

    if args.input:
        if os.path.exists(args.input):
            with open(args.input, "r", encoding="utf-8") as f:
                data = json.load(f)
                scenario_name = data.get("scenario", scenario_name)
                target_zone = data.get("targetZone", data.get("targetField", target_zone))
                interval = float(data.get("updateIntervalSeconds", interval))
                duration = data.get("durationSeconds", duration)
        else:
            print(f"[ERROR] Input file '{args.input}' not found.")
            sys.exit(1)

    run_simulator(
        scenario_name=scenario_name,
        target_zone=target_zone,
        interval=interval,
        max_ticks=duration,
        backend_url=args.backend_url,
        reset_first=not args.no_reset,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
