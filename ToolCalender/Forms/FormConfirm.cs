namespace ToolCalender.Forms
{
    public class FormConfirm : Form
    {
        private static readonly Color CHeader    = Color.FromArgb(15, 35, 65);
        private static readonly Color CBorder    = Color.FromArgb(226, 232, 240);
        private static readonly Color CText      = Color.FromArgb(15, 23, 42);
        private static readonly Color CSubText   = Color.FromArgb(71, 85, 105);

        public FormConfirm(string title, string message, string confirmText, Color confirmColor)
        {
            // Thiết kế cửa sổ
            this.Text            = title;
            this.Size            = new Size(480, 280);
            this.MinimumSize     = new Size(480, 240);
            this.StartPosition   = FormStartPosition.CenterParent;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox     = false;
            this.MinimizeBox     = false;
            this.BackColor       = Color.White;
            this.Font            = new Font("Segoe UI", 10f);

            // 1. Header (Top)
            var pnlHeader = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = CHeader };
            var lblTitle = new Label
            {
                Text      = title,
                ForeColor = Color.White,
                Font      = new Font("Segoe UI", 11f, FontStyle.Bold),
                Dock      = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding   = new Padding(20, 0, 0, 0)
            };
            pnlHeader.Controls.Add(lblTitle);

            // 2. Đường kẻ Accent (Top)
            var pnlAccent = new Panel { Dock = DockStyle.Top, Height = 4, BackColor = confirmColor };

            // 3. Vùng nút bấm (Bottom)
            var pnlActions = new Panel { Dock = DockStyle.Bottom, Height = 70, BackColor = Color.FromArgb(248, 250, 252), Padding = new Padding(0, 0, 15, 0) };
            
            // Dùng FlowLayoutPanel để căn phải nút bấm tự động
            var flowButtons = new FlowLayoutPanel
            {
                Dock      = DockStyle.Fill,
                FlowDirection = FlowDirection.RightToLeft,
                Padding   = new Padding(0, 14, 0, 0)
            };

            var btnCancel = new Button
            {
                Text         = "Hủy",
                Size         = new Size(110, 42),
                BackColor    = Color.White,
                ForeColor    = CSubText,
                FlatStyle    = FlatStyle.Flat,
                Font         = new Font("Segoe UI", 10f, FontStyle.Bold),
                Cursor       = Cursors.Hand,
                DialogResult = DialogResult.Cancel,
                Margin       = new Padding(5, 0, 5, 0)
            };
            btnCancel.FlatAppearance.BorderColor = CBorder;

            var btnConfirm = new Button
            {
                Text       = confirmText,
                Size       = new Size(130, 42),
                BackColor  = confirmColor,
                ForeColor  = Color.White,
                FlatStyle  = FlatStyle.Flat,
                Font       = new Font("Segoe UI", 10f, FontStyle.Bold),
                Cursor     = Cursors.Hand,
                DialogResult = DialogResult.OK,
                Margin       = new Padding(5, 0, 5, 0)
            };
            btnConfirm.FlatAppearance.BorderSize = 0;

            flowButtons.Controls.Add(btnCancel);
            flowButtons.Controls.Add(btnConfirm);
            pnlActions.Controls.Add(flowButtons);

            // 4. Vùng nội dung (Fill)
            var pnlContent = new Panel { Dock = DockStyle.Fill, Padding = new Padding(25, 20, 25, 10) };
            var lblMsg = new Label
            {
                Text      = message,
                ForeColor = CText,
                Font      = new Font("Segoe UI Semibold", 10.5f),
                Dock      = DockStyle.Fill,
                TextAlign = ContentAlignment.TopLeft
            };
            pnlContent.Controls.Add(lblMsg);

            // Thứ tự Add rất quan trọng để Dock hoạt động đúng: Fill Add cuối cùng
            this.Controls.Add(pnlContent);
            this.Controls.Add(pnlActions);
            this.Controls.Add(pnlAccent);
            this.Controls.Add(pnlHeader);

            this.AcceptButton = btnConfirm;
            this.CancelButton = btnCancel;
        }
    }
}
