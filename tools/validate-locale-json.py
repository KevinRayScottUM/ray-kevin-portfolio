"""Reject duplicate object keys before the JavaScript catalog is generated."""
import json
import sys


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate locale key: {key}")
        result[key] = value
    return result


with open(sys.argv[1], encoding="utf-8") as source:
    json.load(source, object_pairs_hook=unique_object)
