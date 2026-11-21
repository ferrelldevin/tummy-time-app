import { useId, useState } from "react";
import type { Lesson } from "@tummy/shared";
import { en } from "../strings/en";
import { Icon } from "./Icon";

type Check = Lesson["checks"][number];

/**
 * A quick check: one question, tap an answer, see why. Not a test: no score, and the answer is
 * not saved or sent anywhere. A wrong answer can be changed.
 */
export function QuickCheck({ check, number }: { check: Check; number: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const id = useId();
  const right = picked !== null && check.choices[picked]?.right === true;
  return (
    <fieldset className="check">
      <legend className="check__question">
        <span className="check__num" aria-hidden="true">
          {number}
        </span>
        {check.question}
      </legend>
      <div className="check__choices">
        {check.choices.map((choice, i) => {
          const chosen = picked === i;
          const state = !chosen
            ? ""
            : choice.right
              ? " check__choice--right"
              : " check__choice--wrong";
          return (
            <label key={i} className={`check__choice${state}`}>
              <input
                type="radio"
                name={id}
                className="choice__input"
                checked={chosen}
                onChange={() => {
                  setPicked(i);
                }}
              />
              <span className="check__mark" aria-hidden="true">
                {chosen ? <Icon name={choice.right ? "check" : "plus"} size={16} /> : null}
              </span>
              <span>{choice.text}</span>
            </label>
          );
        })}
      </div>
      <div className="check__feedback" role="status">
        {picked === null ? null : (
          <p className={right ? "check__result check__result--right" : "check__result"}>
            <strong>{right ? en.lessons.checkRight : en.lessons.checkNotQuite}</strong>{" "}
            {right ? check.explain : en.lessons.checkTryAnother}
          </p>
        )}
      </div>
    </fieldset>
  );
}
