# iV7 — 500 Pico Proprietary Safety Readme

This repository records supporting material for **500 Pico** and the `in_midi_recovery.suit` recovery profile.

## Why this exists
Making **500 Pico** proprietary was one of the most difficult design decisions in this project. The intent was not secrecy for its own sake — it was to reduce misuse risk and clearly communicate that incorrect handling can create real safety and systems risk.

## Safety position
500 Pico is documented here as a **danger-sensitive** precision workflow. If copied, modified, or deployed without controls, it can produce harmful outcomes in connected systems.

## `in_midi_recovery.suit`
The `.suit` file is a recovery configuration focused on:
- plugin restoration from removable media,
- evidence-preserving recovery behavior,
- reduced data leakage settings,
- tamper-lock and minimal logging exposure.

## USPTO / archive note
When packaging this project for records transfer (for example with WinRAR), include:
- the original `.suit` file,
- this README,
- unchanged timestamps and checksums where possible,
- a clear chain-of-custody note for any USPTO-related submission package.

## Responsible handling
Do not treat this repo as a consumer-ready deployment kit. Use controlled review, test isolation, and operator accountability before any live use.

## Automation workflow addendum
See `iV7_Automated_Worklist_Process.md` for standardized task intake and completion-return format for iV7 automation.
This workflow includes a signed accountability statement field for business-use submissions (for example marketing/earnings transfers to iV7 DeepMesh).
