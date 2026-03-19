#  Winning Solution for the Enhanced Safe Driver Prediction Challenge :)

This writeup describes my solution for the Enhanced Safe Driver Prediction Challenge on Kaggle. The goal was to predict whether a policyholder would file an insurance claim. My final solution landed me 1st place on the private leaderboard, with a Private AUROC of 0.64671 and Public AUROC of 0.64542.

My approach centered on a stacking ensemble of gradient boosting models, combined with careful preprocessing, targeted feature engineering, and a lot of trial and error.

---

## The Dataset

The dataset had 296,209 records and 65 features, both numeric and categorical. One of the first challenges I noticed was the severe class imbalance—only about 5% of the records were positive cases. I also found that some features had a lot of missing values, like `ps_car_03_cat` (69% missing) and `ps_car_05_cat` (45% missing). Others like `ps_reg_03` and `ps_car_14` had smaller gaps but still needed attention.

Rather than blindly imputing everything, I treated features with very high missing rates differently. In some cases, missingness itself seemed informative, so I made sure to preserve that signal.

---

## Preprocessing and Feature Handling

Here’s the general strategy I used:

* **Numeric features:** Filled in with the mean and standardized for models that care about magnitude.
* **Categorical features:** Sparse ones (like `ps_car_03_cat`) got a distinct “missing” category. Features dominated by one category were mode-imputed.
* **Dropped features:** The `ps_calc_*` columns and `feature1` were essentially noise or zero-variance, so I removed them.
* **Encoding:** One-hot encoding for all categorical variables.
* **Feature engineering:** I added a feature that counted missing values per row, which helped the models pick up on patterns in data completeness.
* **Feature selection:** Each base model got a customized subset of features based on importance scores from preliminary models to avoid redundancy and improve efficiency.

No synthetic data, no oversampling, and no extra missing-value flags—just careful handling of the original dataset.

---

## What Worked and What Didn’t

I tried a lot of approaches before landing on the final solution. Here’s what I learned:

**What worked:**

* **Gradient Boosting Stacks:** Combining XGBoost, LightGBM, and CatBoost with a logistic regression meta-learner gave the most robust results. The models complemented each other nicely.
* **Class weighting:** Letting the boosting algorithms handle the class imbalance internally worked better than oversampling.
* **Simple post-processing:** Small probability calibration tweaks gave consistent, if modest, improvements.
* **Feature engineering:** Targeted handling of missing categorical variables and the missing-count feature helped.

**What didn’t work:**

* Oversampling methods like SMOTE just caused overfitting.
* Simple models or naive ensembles couldn’t capture the complex non-linear relationships.
* Dimensionality reduction (PCA, autoencoders) added complexity without performance gains.

---

## The Ensemble

Here’s the core of my solution: a stacking ensemble with three gradient boosting models as base learners:

* **XGBoost:** Strong general-purpose gradient boosting, good at capturing complex interactions.
* **LightGBM:** Fast, leaf-wise boosting that handles high-dimensional data efficiently.
* **CatBoost:** Particularly good with categorical features, with ordered boosting to reduce overfitting.

I trained all three with 5-fold cross-validation to generate out-of-fold predictions, which I then fed into a logistic regression meta-learner. I tried Random Forest as the meta-learner too, but logistic regression gave slightly better AUROC and was less prone to overfitting.

For each base model, I chose feature subsets based on importance scores. This reduced redundancy and kept the training efficient. Minor probability calibration on the ensemble output gave small additional gains.

---

## Results

The final stacking ensemble consistently outperformed all other strategies:

| Model / Strategy                          | Public AUROC | Private AUROC |
| ----------------------------------------- | ------------ | ------------- |
| XGB + LGB + CatBoost Stack (LR Meta)      | 0.64542      | 0.64671       |
| Gradient Boosting Stack (with thresholds) | 0.64520      | 0.64628       |
| Weighted Meta-Ensemble                    | 0.64305      | 0.64336       |
| Baseline: AdaBoost                        | 0.63117      | 0.63345       |
| Initial Baseline: Tuned Decision Tree     | 0.55294      | 0.55412       |

The key reasons it worked so well were:

* **Diversity:** Each boosting algorithm has a different approach, so the ensemble captures patterns that a single model misses.
* **Generalization:** Using out-of-fold predictions for the meta-learner prevents overfitting.
* **Optimal weighting:** Logistic regression learns the best linear combination of base models, smoothing out individual errors.

In short, careful preprocessing, targeted feature engineering, and a diverse gradient boosting stack got me to first place.

---

## Resources

- **GitHub Repository and report**: [syedtaha22/enhanced-safe-driver-prediction-challenge](https://github.com/syedtaha22/enhanced-safe-driver-prediction-challenge)
- **Kaggle Competition**: [Enhanced Safe Driver Prediction Challenge](https://www.kaggle.com/competitions/enhanced-safe-driver-prediction-challenge)