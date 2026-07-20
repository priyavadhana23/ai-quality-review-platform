import React from "react";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z
  .object({
    pr_url: z
      .string()
      .min(1, "PR URL is required")
      .startsWith("https://", "Must start with https://"),
    tool: z.enum(["review", "describe", "improve", "ask"]),
    question: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tool === "ask" && (!data.question || data.question.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Question must be at least 3 characters",
        path: ["question"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface AnalyzeFormProps {
  onSubmit: (values: FormValues) => void;
  isLoading: boolean;
}

export const AnalyzeForm: React.FC<AnalyzeFormProps> = ({ onSubmit, isLoading }) => {
  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pr_url: "", tool: "review", question: "" },
  });

  const tool = watch("tool");

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Controller
        name="pr_url"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="GitHub Pull Request URL"
            placeholder="https://github.com/owner/repo/pull/123"
            fullWidth
            error={!!fieldState.error}
            helperText={
              fieldState.error?.message ?? "Paste the full URL of any GitHub or GitLab pull request"
            }
            disabled={isLoading}
            inputProps={{ "aria-label": "Pull request URL" }}
          />
        )}
      />

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Controller
          name="tool"
          control={control}
          render={({ field }) => (
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Analysis Tool</InputLabel>
              <Select {...field} label="Analysis Tool" disabled={isLoading}>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="describe">Describe</MenuItem>
                <MenuItem value="improve">Improve</MenuItem>
                <MenuItem value="ask">Ask</MenuItem>
              </Select>
              <FormHelperText>Choose the PR-Agent tool</FormHelperText>
            </FormControl>
          )}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isLoading}
          startIcon={<AutoFixHighIcon />}
          sx={{ height: 56, minWidth: 140 }}
        >
          {isLoading ? "Analyzing…" : "Analyze"}
        </Button>
      </Box>

      {tool === "ask" && (
        <Controller
          name="question"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Your Question"
              placeholder="e.g. Explain the security implications of this change"
              fullWidth
              multiline
              minRows={2}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isLoading}
            />
          )}
        />
      )}
    </Box>
  );
};

export type { FormValues as AnalyzeFormValues };
