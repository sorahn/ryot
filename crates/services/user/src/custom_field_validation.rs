use std::collections::HashSet;

use anyhow::{Result, bail, ensure};
use chrono::NaiveDate;
use dependent_models::SaveCustomFieldInput;
use enum_models::CustomFieldKind;
use serde_json::Value;

pub fn validate_definition(input: &SaveCustomFieldInput) -> Result<()> {
    ensure!(
        !input.name.is_empty() && input.name.chars().count() <= 120,
        "Field names must contain 1–120 characters"
    );
    ensure!(
        input
            .description
            .as_ref()
            .is_none_or(|v| v.chars().count() <= 2000),
        "Field descriptions must be at most 2000 characters"
    );
    ensure!(
        input.media_lots.iter().collect::<HashSet<_>>().len() == input.media_lots.len(),
        "Media types must be unique"
    );
    let is_choice = matches!(
        input.kind,
        CustomFieldKind::Select | CustomFieldKind::MultiSelect
    );
    if is_choice {
        ensure!(
            !input.options.is_empty() && input.options.len() <= 100,
            "Choice fields require 1–100 options"
        );
        ensure!(
            input
                .options
                .iter()
                .all(|v| !v.is_empty() && v.chars().count() <= 200),
            "Options must contain 1–200 characters"
        );
        ensure!(
            input.options.iter().collect::<HashSet<_>>().len() == input.options.len(),
            "Choice options must be unique"
        );
    } else {
        ensure!(
            input.options.is_empty(),
            "Only choice fields may have options"
        );
    }
    Ok(())
}

pub fn validate_value(kind: CustomFieldKind, options: &[String], value: &Value) -> Result<()> {
    let valid = match kind {
        CustomFieldKind::Text => value.as_str().is_some_and(|v| v.chars().count() <= 20000),
        CustomFieldKind::Number => value.is_number(),
        CustomFieldKind::Checkbox => value.is_boolean(),
        CustomFieldKind::Date => value.as_str().is_some_and(|v| {
            v.len() == 10
                && NaiveDate::parse_from_str(v, "%Y-%m-%d")
                    .is_ok_and(|d| d.format("%Y-%m-%d").to_string() == v)
        }),
        CustomFieldKind::Select => value
            .as_str()
            .is_some_and(|v| options.iter().any(|o| o == v)),
        CustomFieldKind::MultiSelect => value.as_array().is_some_and(|v| {
            let strings: Option<Vec<_>> = v.iter().map(Value::as_str).collect();
            strings.is_some_and(|v| {
                v.iter().collect::<HashSet<_>>().len() == v.len()
                    && v.iter().all(|s| options.iter().any(|o| o == s))
            })
        }),
    };
    if !valid {
        bail!("Value does not match the field type or its allowed options");
    }
    Ok(())
}
