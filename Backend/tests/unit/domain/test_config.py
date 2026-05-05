"""Tests for configuration management domain logic."""

import pytest

from nisha.domain.models.config import (
    apply_delta,
    compute_config_hash,
    compute_delta,
)


class TestConfigHash:
    def test_same_config_same_hash(self):
        config = {"a": 1, "b": "hello"}
        assert compute_config_hash(config) == compute_config_hash(config)

    def test_different_config_different_hash(self):
        c1 = {"a": 1}
        c2 = {"a": 2}
        assert compute_config_hash(c1) != compute_config_hash(c2)

    def test_key_order_irrelevant(self):
        c1 = {"a": 1, "b": 2}
        c2 = {"b": 2, "a": 1}
        assert compute_config_hash(c1) == compute_config_hash(c2)

    def test_hash_is_16_chars(self):
        h = compute_config_hash({"test": True})
        assert len(h) == 16


class TestDeltaComputation:
    def test_no_changes(self):
        config = {"a": 1, "b": 2}
        assert compute_delta(config, config) == {}

    def test_added_key(self):
        old = {"a": 1}
        new = {"a": 1, "b": 2}
        delta = compute_delta(old, new)
        assert delta == {"b": 2}

    def test_removed_key(self):
        old = {"a": 1, "b": 2}
        new = {"a": 1}
        delta = compute_delta(old, new)
        assert delta == {"b": None}

    def test_changed_value(self):
        old = {"a": 1}
        new = {"a": 42}
        delta = compute_delta(old, new)
        assert delta == {"a": 42}

    def test_nested_change(self):
        old = {"sensors": {"audio": {"enabled": True, "gain": 10}}}
        new = {"sensors": {"audio": {"enabled": True, "gain": 20}}}
        delta = compute_delta(old, new)
        assert delta == {"sensors": {"audio": {"gain": 20}}}

    def test_nested_addition(self):
        old = {"sensors": {"audio": {"enabled": True}}}
        new = {"sensors": {"audio": {"enabled": True, "gain": 10}}}
        delta = compute_delta(old, new)
        assert delta == {"sensors": {"audio": {"gain": 10}}}

    def test_type_change(self):
        old = {"a": {"nested": True}}
        new = {"a": "flat_string"}
        delta = compute_delta(old, new)
        assert delta == {"a": "flat_string"}


class TestDeltaApplication:
    def test_apply_empty_delta(self):
        base = {"a": 1, "b": 2}
        result = apply_delta(base, {})
        assert result == base

    def test_apply_addition(self):
        base = {"a": 1}
        result = apply_delta(base, {"b": 2})
        assert result == {"a": 1, "b": 2}

    def test_apply_deletion(self):
        base = {"a": 1, "b": 2}
        result = apply_delta(base, {"b": None})
        assert result == {"a": 1}

    def test_apply_change(self):
        base = {"a": 1}
        result = apply_delta(base, {"a": 42})
        assert result == {"a": 42}

    def test_apply_nested(self):
        base = {"sensors": {"audio": {"enabled": True, "gain": 10}}}
        result = apply_delta(base, {"sensors": {"audio": {"gain": 20}}})
        assert result == {"sensors": {"audio": {"enabled": True, "gain": 20}}}

    def test_roundtrip(self):
        """compute_delta then apply_delta should reproduce the new config."""
        old = {"a": 1, "b": {"c": 3, "d": 4}, "e": 5}
        new = {"a": 1, "b": {"c": 30, "d": 4}, "f": 6}
        delta = compute_delta(old, new)
        result = apply_delta(old, delta)
        assert result == new

    def test_delete_nonexistent_key(self):
        base = {"a": 1}
        result = apply_delta(base, {"z": None})
        assert result == {"a": 1}
