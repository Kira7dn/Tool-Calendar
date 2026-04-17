using System;
using System.Linq;

namespace ToolCalender.Tests.Helpers
{
    public static class AccuracyCalculator
    {
        /// <summary>
        /// Tính toán tỷ lệ trùng khớp (%) giữa văn bản gốc và văn bản trích xuất
        /// </summary>
        public static double CalculateMatchRate(string original, string extracted)
        {
            if (string.IsNullOrEmpty(original) && string.IsNullOrEmpty(extracted)) return 100.0;
            if (string.IsNullOrEmpty(original) || string.IsNullOrEmpty(extracted)) return 0.0;

            // Chuẩn hóa văn bản: xóa khoảng trắng thừa, đưa về chữ thường
            string s1 = NormalizeText(original);
            string s2 = NormalizeText(extracted);

            int distance = LevenshteinDistance(s1, s2);
            int maxLen = Math.Max(s1.Length, s2.Length);

            return Math.Round((1.0 - (double)distance / maxLen) * 100, 2);
        }

        private static string NormalizeText(string text)
        {
            return string.Join(" ", text.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)).ToLower();
        }

        private static int LevenshteinDistance(string s, string t)
        {
            int n = s.Length;
            int m = t.Length;
            int[,] d = new int[n + 1, m + 1];

            if (n == 0) return m;
            if (m == 0) return n;

            for (int i = 0; i <= n; d[i, 0] = i++) ;
            for (int j = 0; j <= m; d[0, j] = j++) ;

            for (int i = 1; i <= n; i++)
            {
                for (int j = 1; j <= m; j++)
                {
                    int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(
                        Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                        d[i - 1, j - 1] + cost);
                }
            }
            return d[n, m];
        }
    }
}
